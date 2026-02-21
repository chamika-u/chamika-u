import https from 'https';

const token = process.env.PAT_1;
const username = process.env.GITHUB_REPOSITORY_OWNER || 'chamika-u';

function graphqlRequest(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request(
      {
        hostname: 'api.github.com',
        path: '/graphql',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'chamika-u-streak-generator',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse failed: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getContributions() {
  const query = `{
    user(login: "${username}") {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }`;
  const result = await graphqlRequest(query);
  if (result.errors) throw new Error(JSON.stringify(result.errors));
  return result.data.user.contributionsCollection.contributionCalendar;
}

function computeStreaks(weeks) {
  const days = weeks
    .flatMap(w => w.contributionDays)
    .sort((a, b) => a.date.localeCompare(b.date));

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Build a map for quick lookup
  const contribMap = {};
  for (const day of days) contribMap[day.date] = day.contributionCount;

  // Calculate longest streak — prevDate tracks only the last day WITH contributions
  let longestStreak = 0;
  let run = 0;
  let prevDate = null;
  for (const day of days) {
    if (day.contributionCount > 0) {
      if (prevDate !== null) {
        const diff = Math.round(
          (new Date(day.date) - new Date(prevDate)) / 86400000
        );
        run = diff === 1 ? run + 1 : 1;
      } else {
        run = 1;
      }
      if (run > longestStreak) longestStreak = run;
      prevDate = day.date; // only advance prevDate on contributing days
    } else {
      run = 0;
    }
  }

  // Calculate current streak — grace period: today counts even with no contributions yet
  // Start from today if it has contributions, otherwise fall back to yesterday (grace period)
  let currentStreak = 0;
  const startDate =
    contribMap[today] > 0 ? today : contribMap[yesterday] > 0 ? yesterday : null;
  if (startDate) {
    let checkDate = startDate;
    while (contribMap[checkDate] > 0) {
      currentStreak++;
      const d = new Date(checkDate);
      d.setDate(d.getDate() - 1);
      checkDate = d.toISOString().split('T')[0];
    }
  }

  return { currentStreak, longestStreak };
}

function renderSVG(total, currentStreak, longestStreak) {
  const w = 500;
  const h = 160;
  const sw = w / 3;
  const baseFont = "'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="GitHub Streak Stats">
  <title>GitHub Streak Stats</title>
  <desc>Total Contributions: ${total}, Current Streak: ${currentStreak} days, Longest Streak: ${longestStreak} days</desc>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="4.5" fill="#0d1117" stroke="#21262d" stroke-opacity="1"/>
  <line x1="${sw}" y1="20" x2="${sw}" y2="${h - 20}" stroke="#21262d" stroke-width="1"/>
  <line x1="${sw * 2}" y1="20" x2="${sw * 2}" y2="${h - 20}" stroke="#21262d" stroke-width="1"/>

  <!-- Total Contributions -->
  <text x="${sw * 0.5}" y="65" text-anchor="middle" font-family="${baseFont}" font-size="30" font-weight="700" fill="#58a6ff">${total}</text>
  <text x="${sw * 0.5}" y="92" text-anchor="middle" font-family="${baseFont}" font-size="11" fill="#8b949e">Total Contributions</text>
  <text x="${sw * 0.5}" y="110" text-anchor="middle" font-family="${baseFont}" font-size="11" fill="#8b949e">Past Year</text>

  <!-- Current Streak (center, highlighted) -->
  <text x="${sw * 1.5}" y="62" text-anchor="middle" font-family="${baseFont}" font-size="34" font-weight="700" fill="#ff7b25">${currentStreak}</text>
  <text x="${sw * 1.5}" y="88" text-anchor="middle" font-family="${baseFont}" font-size="12" font-weight="600" fill="#ff7b25">Current Streak</text>
  <text x="${sw * 1.5}" y="106" text-anchor="middle" font-family="${baseFont}" font-size="11" fill="#8b949e">days</text>

  <!-- Longest Streak -->
  <text x="${sw * 2.5}" y="65" text-anchor="middle" font-family="${baseFont}" font-size="30" font-weight="700" fill="#58a6ff">${longestStreak}</text>
  <text x="${sw * 2.5}" y="92" text-anchor="middle" font-family="${baseFont}" font-size="11" fill="#8b949e">Longest Streak</text>
  <text x="${sw * 2.5}" y="110" text-anchor="middle" font-family="${baseFont}" font-size="11" fill="#8b949e">days</text>
</svg>`;
}

async function main() {
  const calendar = await getContributions();
  const { currentStreak, longestStreak } = computeStreaks(calendar.weeks);
  const total = calendar.totalContributions;
  process.stdout.write(renderSVG(total, currentStreak, longestStreak) + '\n');
}

main().catch(err => {
  console.error('Error generating streak SVG:', err.message);
  process.exit(1);
});
