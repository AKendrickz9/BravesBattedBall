// workers/index.js

function parseData(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  const re = /("([^"]*(?:""[^"]*)*)"|[^,]+)(?=(,|$))/g;

  return lines.slice(1).map(line => {
    const values = [];
    let match;
    while ((match = re.exec(line))) {
      let v = match[1];
      if (v.startsWith('"') && v.endsWith('"')) {
        v = v.slice(1, -1).replace(/""/g, '"');
      }
      values.push(v);
    }
    const row = {};
    headers.forEach((h, i) => (row[h] = values[i]));

    return {
      batter:      row.BATTER,
      gameDate:    row.GAME_DATE,
      pitcher:     row.PITCHER,
      launchAngle: parseFloat(row.LAUNCH_ANGLE),
      exitSpeed:   parseFloat(row.EXIT_SPEED),
      distance:    parseFloat(row.HIT_DISTANCE),
      spinRate:    parseFloat(row.HIT_SPIN_RATE),
      direction:   row.EXIT_DIRECTION,
      outcome:     row.PLAY_OUTCOME,
      videoLink:   row.VIDEO_LINK
    };
  });
}

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

export default {
  async fetch(request) {
    const url  = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin':  '*',
          'Access-Control-Allow-Methods': 'GET,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

 async function loadData() {
  try {
    const githubRawUrl = 'https://raw.githubusercontent.com/AKendrickz9/BravesBattedBall/main/battedball.csv';
    const resp = await fetch(githubRawUrl);
    const txt  = await resp.text();
    const data = parseData(txt);
    return data;
  } catch (e) {
    console.error('Error in loadData:', e);
    throw e;
  }
}

    if (path === '/home') {
      const all = await loadData();
      const LAs = all.map(r => r.launchAngle).filter(v => !isNaN(v));
      const EVs = all.map(r => r.exitSpeed).filter(v => !isNaN(v));
      const HRs = all.filter(r => r.outcome === 'HomeRun').map(r => r.distance).filter(v => !isNaN(v));
      const SPs = all.map(r => r.spinRate).filter(v => !isNaN(v));

      const averages = {
        avgLaunchAngle: mean(LAs),
        avgExitSpeed:    mean(EVs),
        avgHRDistance:   mean(HRs),
        avgSpinRate:     mean(SPs)
      };

      const topHR = all
        .filter(r => r.outcome === 'HomeRun')
        .sort((a, b) => b.distance - a.distance)
        .slice(0, 5)
        .map(r => ({ ...r }));

      const topEV = all
        .sort((a, b) => b.exitSpeed - a.exitSpeed)
        .slice(0, 5)
        .map(r => ({ ...r }));

      const batters = Array.from(new Set(all.map(r => r.batter))).sort();

      return new Response(JSON.stringify({ averages, topHR, topEV, batters }), {
        headers: {
          'Content-Type':                'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (path === '/batter') {
      const player = url.searchParams.get('player');
      if (!player) {
        return new Response('Missing player', { status: 400 });
      }
      const all  = await loadData();
      const hits = all.filter(r => r.batter === player);

      const spinSeries = hits
        .filter(r => !isNaN(r.spinRate))
        .map(r => ({ x: r.gameDate, y: r.spinRate }));

      const total = hits.length;

      const hardHits = hits.filter(r => r.exitSpeed >= 95).length;

      const barrels = hits.filter(r =>
        r.launchAngle >= 26 && r.launchAngle <= 30 && r.exitSpeed >= 98
      ).length;

      const sweetLA = hits.filter(r =>
        r.launchAngle >= 10 && r.launchAngle <= 30
      ).length;

      const avgEV = total
        ? hits.reduce((sum, r) => sum + (r.exitSpeed || 0), 0) / total
        : null;

      const squareUp = hits.filter(r =>
        Math.abs(r.launchAngle - 20) <= 5 && r.exitSpeed >= 80
      ).length;

      function pct(n) {
        return total ? +((n / total) * 100).toFixed(1) : null;
      }

      const metrics = {
        hardHitPct:  pct(hardHits),
        barrelPct:   pct(barrels),
        sweetLaPct:  pct(sweetLA),
        avgExitVel:  avgEV ? +avgEV.toFixed(1) : null,
        squareUpPct: pct(squareUp)
      };

      return new Response(JSON.stringify({
        batter:    player,
        hits,
        spinSeries,
        metrics
      }), {
        headers: {
          'Content-Type':                'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return fetch(request);
  }
};
