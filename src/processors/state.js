import { startsWith, every } from 'lodash';
import { configForRepo, prettifierLog } from '../utils';
import mdRenderer from '../md-renderer';
import { isMacroIssueEvent } from '../validators';

function updateIssueState(repoName, issue, state) {
  const { github, org, name } = configForRepo(repoName);
  github.repos(org, name).issues(issue.number).update({ state });
}

function processMacroIssueState(repoName, macroIssue) {
  const visitors = {
    onSubissues: (list) => {
      const isEverySubIssueClosed = every(list, listItem => startsWith(listItem.text.join(''), '[x]'));
      if (macroIssue.state !== 'closed' && isEverySubIssueClosed) {
        prettifierLog(`Closing macro issue #${macroIssue.number} in repo ${repoName}`);
        updateIssueState(repoName, macroIssue, 'closed');
      } else if (macroIssue.state !== 'open' && !isEverySubIssueClosed) {
        prettifierLog(`Reopening macro issue #${macroIssue.number} in repo ${repoName}`);
        updateIssueState(repoName, macroIssue, 'open');
      }
      return list;
    }
  };

  mdRenderer(macroIssue.body, visitors);
}


export default ({ subject }) => {
  // macro issues
  subject
    .filter(isMacroIssueEvent)
    .subscribe(({ body: { issue, repository: repo } }) => {
      processMacroIssueState(repo.name, issue);
    });
};
