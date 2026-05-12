// Cloudflare Web Analytics via GraphQL. Returns page views and visitors over a date range.
const ZONE_TAG = '5641be3e859feae0578c5b22c8c0ea5f';

function dateNDaysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function onRequestGet({ request, env }) {
  if (!env.CF_ANALYTICS_TOKEN) {
    return new Response(JSON.stringify({ error: 'CF_ANALYTICS_TOKEN not configured' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '7');
  const since = dateNDaysAgo(days);
  const until = dateNDaysAgo(0);

  const query = `query {
    viewer {
      zones(filter: {zoneTag: "${ZONE_TAG}"}) {
        totals: httpRequests1dGroups(limit: 1, filter: {date_geq: "${since}", date_leq: "${until}"}) {
          sum { requests pageViews bytes threats }
          uniq { uniques }
        }
        byDay: httpRequests1dGroups(limit: 31, filter: {date_geq: "${since}", date_leq: "${until}"}, orderBy: [date_ASC]) {
          dimensions { date }
          sum { requests pageViews }
          uniq { uniques }
        }
        topCountries: httpRequests1dGroups(limit: 31, filter: {date_geq: "${since}", date_leq: "${until}"}) {
          sum {
            countryMap {
              clientCountryName
              requests
            }
          }
        }
      }
    }
  }`;

  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CF_ANALYTICS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`CF ${res.status}: ${t.substring(0, 200)}`);
    }
    const data = await res.json();
    if (data.errors) throw new Error(JSON.stringify(data.errors[0]));
    const zone = data.data?.viewer?.zones?.[0] || {};
    // Flatten countryMap from hourly buckets into top list
    const countryAgg = {};
    (zone.topCountries || []).forEach(group => {
      (group.sum?.countryMap || []).forEach(c => {
        countryAgg[c.clientCountryName] = (countryAgg[c.clientCountryName] || 0) + (c.requests || 0);
      });
    });
    const topCountries = Object.entries(countryAgg)
      .map(([name, count]) => ({ count, dimensions: { countryName: name } }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return new Response(JSON.stringify({
      since, until, days,
      totals: zone.totals?.[0] || { sum: { requests: 0, pageViews: 0 }, uniq: { uniques: 0 } },
      byDay: zone.byDay || [],
      topCountries,
    }), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
