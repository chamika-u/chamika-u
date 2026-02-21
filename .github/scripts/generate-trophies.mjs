import https from 'https';

const token = process.env.PAT_1;
const username = process.env.GITHUB_REPOSITORY_OWNER || 'chamika-u';

function restRequest(path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.github.com',
        path,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'chamika-u-trophy-generator',
          Accept: 'application/vnd.github.v3+json',
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
    req.end();
  });
}

function graphqlRequest(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const req = https.request(
      {
        hostname: 'api.github.com',
        path: '/graphql',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'chamika-u-trophy-generator',
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

function getRank(value, thresholds) {
  if (value >= thresholds[0]) return 'SSS';
  if (value >= thresholds[1]) return 'SS';
  if (value >= thresholds[2]) return 'S';
  if (value >= thresholds[3]) return 'AAA';
  if (value >= thresholds[4]) return 'AA';
  if (value >= thresholds[5]) return 'A';
  return 'B';
}

const rankColors = {
  SSS: '#f9d923',
  SS: '#f9a825',
  S:   '#ff7043',
  AAA: '#ce93d8',
  AA:  '#42a5f5',
  A:   '#26a69a',
  B:   '#8b949e',
};

function trophyCard(x, y, title, value, rank) {
  const color = rankColors[rank] || rankColors.B;
  const cardW = 140;
  const cardH = 135;
  return `<g transform="translate(${x},${y})">
    <rect width="${cardW}" height="${cardH}" rx="8" fill="#161b22" stroke="${color}" stroke-width="1.5" stroke-opacity="0.7"/>
    <svg x="50" y="8" width="40" height="40" viewBox="0 0 40 40">
      <path d="M8 4h24v10c0 5.5-4.5 10-10 10S12 19.5 12 14V4zM4 6h4v6c0 1.1.9 2 2 2v2c0 .7.1 1.4.2 2H9C7.3 21 6 22.3 6 24h28c0-1.7-1.3-3-3-3h-1.2c.1-.6.2-1.3.2-2v-2c1.1 0 2-.9 2-2V6h4v2c0 2.2-1.8 4-4 4v2c0 6.1-4.9 11-11 11S10 20.1 10 14v-2C7.8 12 6 10.2 6 8V6z" fill="${color}" fill-opacity="0.85"/>
    </svg>
    <text x="${cardW / 2}" y="60" text-anchor="middle" font-family="'Segoe UI',Ubuntu,sans-serif" font-size="10" fill="#8b949e">${title}</text>
    <text x="${cardW / 2}" y="88" text-anchor="middle" font-family="'Segoe UI',Ubuntu,sans-serif" font-size="22" font-weight="700" fill="${color}">${value.toLocaleString()}</text>
    <rect x="40" y="98" width="60" height="22" rx="5" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="1" stroke-opacity="0.5"/>
    <text x="${cardW / 2}" y="114" text-anchor="middle" font-family="'Segoe UI',Ubuntu,monospace" font-size="12" font-weight="700" fill="${color}">${rank}</text>
  </g>`;
}

async function fetchData() {
  const [user, repos] = await Promise.all([
    restRequest(`/users/${username}`),
    restRequest(`/users/${username}/repos?per_page=100&type=owner`),
  ]);

  const totalStars = Array.isArray(repos)
    ? repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0)
    : 0;

  // Fetch total commits via GraphQL contributions calendar (past year)
  const gql = await graphqlRequest(
    `query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          totalCommitContributions
          restrictedContributionsCount
        }
        pullRequests { totalCount }
        issues { totalCount }
      }
    }`,
    { login: username }
  );

  const contrib = gql?.data?.user?.contributionsCollection || {};
  const commits =
    (contrib.totalCommitContributions || 0) +
    (contrib.restrictedContributionsCount || 0);
  const prs = gql?.data?.user?.pullRequests?.totalCount || 0;
  const issues = gql?.data?.user?.issues?.totalCount || 0;

  return {
    repos: user.public_repos || 0,
    followers: user.followers || 0,
    stars: totalStars,
    commits,
    prs,
    issues,
  };
}

async function main() {
  const data = await fetchData();

  const trophies = [
    {
      title: 'Repositories',
      value: data.repos,
      rank: getRank(data.repos, [100, 50, 25, 10, 5, 1]),
    },
    {
      title: 'Commits',
      value: data.commits,
      rank: getRank(data.commits, [2000, 1000, 500, 200, 100, 50]),
    },
    {
      title: 'Stars',
      value: data.stars,
      rank: getRank(data.stars, [1000, 500, 200, 100, 50, 10]),
    },
    {
      title: 'Followers',
      value: data.followers,
      rank: getRank(data.followers, [500, 100, 50, 20, 10, 1]),
    },
    {
      title: 'Pull Requests',
      value: data.prs,
      rank: getRank(data.prs, [1000, 500, 200, 100, 50, 10]),
    },
    {
      title: 'Issues',
      value: data.issues,
      rank: getRank(data.issues, [1000, 500, 200, 100, 50, 10]),
    },
  ];

  const cols = 6;
  const cardW = 140;
  const cardH = 135;
  const gap = 10;
  const padX = 14;
  const padY = 14;
  const rows = Math.ceil(trophies.length / cols);
  const totalW = padX * 2 + cols * cardW + (cols - 1) * gap;
  const totalH = padY * 2 + rows * cardH + (rows - 1) * gap;

  const cards = trophies
    .map((t, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = padX + col * (cardW + gap);
      const y = padY + row * (cardH + gap);
      return trophyCard(x, y, t.title, t.value, t.rank);
    })
    .join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" role="img" aria-label="GitHub Trophies">
  <title>GitHub Trophies</title>
  <desc>GitHub achievement trophies for ${username}</desc>
  <rect width="${totalW}" height="${totalH}" rx="8" fill="#0d1117"/>
  ${cards}
</svg>`;

  process.stdout.write(svg + '\n');
}

main().catch(err => {
  console.error('Error generating trophies SVG:', err.message);
  process.exit(1);
});
