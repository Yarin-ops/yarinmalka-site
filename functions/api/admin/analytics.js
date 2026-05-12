// Cloudflare Web Analytics (RUM) - real human visitor data from JS beacon.
const ACCOUNT_TAG = '5bb1e2244f7cde1e7799484a5d654e3c';
const SITE_TAG = 'a4bcd85c63c14878980008d345a8db88';

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

  const baseFilter = `{date_geq: "${since}", date_leq: "${until}", siteTag: "${SITE_TAG}"}`;
  const refFilter = `{date_geq: "${since}", date_leq: "${until}", siteTag: "${SITE_TAG}", refererHost_neq: ""}`;

  const query = `query {
    viewer {
      accounts(filter: {accountTag: "${ACCOUNT_TAG}"}) {
        totals: rumPageloadEventsAdaptiveGroups(limit: 1, filter: ${baseFilter}) {
          count
          sum { visits }
        }
        byDay: rumPageloadEventsAdaptiveGroups(limit: 31, filter: ${baseFilter}, orderBy: [date_ASC]) {
          count
          dimensions { date }
        }
        topPaths: rumPageloadEventsAdaptiveGroups(limit: 8, filter: ${baseFilter}, orderBy: [count_DESC]) {
          count
          dimensions { requestPath }
        }
        topReferers: rumPageloadEventsAdaptiveGroups(limit: 6, filter: ${refFilter}, orderBy: [count_DESC]) {
          count
          dimensions { refererHost }
        }
        topCountries: rumPageloadEventsAdaptiveGroups(limit: 8, filter: ${baseFilter}, orderBy: [count_DESC]) {
          count
          dimensions { countryName }
        }
        topDevices: rumPageloadEventsAdaptiveGroups(limit: 5, filter: ${baseFilter}, orderBy: [count_DESC]) {
          count
          dimensions { deviceType }
        }
        topBrowsers: rumPageloadEventsAdaptiveGroups(limit: 5, filter: ${baseFilter}, orderBy: [count_DESC]) {
          count
          dimensions { userAgentBrowser }
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
    const acc = data.data?.viewer?.accounts?.[0] || {};
    const totals = acc.totals?.[0] || { count: 0, sum: { visits: 0 } };
    return new Response(JSON.stringify({
      since, until, days,
      pageViews: totals.count || 0,
      visits: totals.sum?.visits || 0,
      byDay: acc.byDay || [],
      topPaths: acc.topPaths || [],
      topReferers: acc.topReferers || [],
      topCountries: acc.topCountries || [],
      topDevices: acc.topDevices || [],
      topBrowsers: acc.topBrowsers || [],
    }), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
