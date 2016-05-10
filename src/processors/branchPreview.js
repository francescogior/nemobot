import { includes } from 'lodash';
import { configForRepo, prettifierLog } from '../utils';
import { isBranchPreviewEvent } from '../validators';

const MARKER = '<!-- SANDCASTLE_COMMENT -->';

async function addBranchPreviewComment(repoName, pullRequestNumber, previewURL) {
  const { github, org, name } = configForRepo(repoName);

  const comments = await github.repos(org, name).issues(pullRequestNumber).comments.fetch();
  const alreadyHasBranchPreviewComment = includes(comments.map(c => c.body), MARKER);

  if (!alreadyHasBranchPreviewComment) {
    prettifierLog(`Adding branch-preview comment to pull request #${pullRequestNumber} in repo ${repoName}`);

    const LINK = `### 🐥 [preview this branch](${previewURL}`;
    const IE_LINK = `### 💩 [preview this branch on IE](https://www.browserling.com/browse/win/7/ie/11/${previewURL}`;
    const CORS_REMINDER = '(remember to [disable CORS](https://chrome.google.com/webstore/detail/allow-control-allow-origi/nlfbmbojpeacfghkpbjhddihlkkiljbi))';
    const API_REMINDER = '*N.B. this runs against the __master__ version of the API*';

    github.repos(org, name).issues(pullRequestNumber).comments.create({
      body: `${MARKER}${[LINK, IE_LINK, CORS_REMINDER, API_REMINDER].join('\n')}`
    });
  }
}

export default ({ subject }) => {
  subject
    .filter(isBranchPreviewEvent)
    .subscribe(({ body: { pullRequestNumber, repoName, previewURL } }) => {
      addBranchPreviewComment(repoName, pullRequestNumber, previewURL);
    });
};
