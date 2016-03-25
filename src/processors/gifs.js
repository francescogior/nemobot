import { configForRepo, prettifierLog } from '../utils';
import request from 'request-promise';

function addSuccessfulGifComment(repoName, pull) {

  const { github, org, name } = configForRepo(repoName);

  request({
    uri: 'http://api.giphy.com/v1/gifs/random',
    qs: {
      api_key: 'dc6zaTOxFJmzC',
      tag: 'success'
    },
    json: true
  }).then(res => {
    const gifUrl = res.data.image_url;
    github.repos(org, name).issues(pull.number).comments.create({
      body: `![](${gifUrl})`
    });
  });

}

export default subject => {
  const source = subject.filter(({ event }) => event === 'pull_request');

  source
  .filter(({ body }) => body.action === 'closed' && body.pull_request && body.pull_request.merged)
  .subscribe(({ body: { pull_request: pull, repository: repo } }) => {
    prettifierLog(`Adding GIF comment to pull request #${pull.number} in repo ${repo.name}`);
    addSuccessfulGifComment(repo.name, pull);
  });
};
