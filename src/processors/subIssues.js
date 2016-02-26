import { includes, find, startsWith } from 'lodash';
import {
  httpLog,
  prettifierLog,
  reviewStateLog,
  configForRepo
} from '../utils';
import mdRenderer from '../md-renderer';

const TITLE = 'sub-issues';
const MD_TITLE = `## ${TITLE}`;

// utils
function updateIssueBody(repoName, body, issue) {
  const { github, org, name } = configForRepo(repoName);
  github.repos(org, name).issues(issue.number).update({ body: body.replace(/\n\n+/g, '\n\n').trim() }); // max one empty line
}

function generateListItem({ state, title, number }) {
  const isOpen = state === 'open';
  return {
    type: 'list',
    body: [
      {
        type: 'listitem',
        text: [ `[${isOpen ? ' ' : 'x'}] ${title.replace(/\[[^\]]+\]/, '').trim()} #${number}` ]
      }
    ],
    ordered: false
  };
}


function patchSubIssuesParagraph(macroIssue, subIssue) {
  const shouldReplaceListItem = (listItem) => includes(listItem.text, `#${subIssue.number}`);

  const visitors = {
    onSubissues: (list) => {
      const isNewSubissue = !find(list, shouldReplaceListItem);
      if (isNewSubissue) {
        return list.concat(generateListItem(subIssue));
      } else {
        return list.map(listItem => {
          if (shouldReplaceListItem(listItem)) {
            return generateListItem(subIssue);
          }
          return listItem;
        });
      }
    }
  };

  return mdRenderer(macroIssue.body, visitors);
}

function generateSubIssuesParagraph(macroIssue, subIssue) {
  const subIssuesHeader = {
    type: 'heading',
    text: [ TITLE ],
    level: 2,
    raw: TITLE
  };

  const visitors = {
    onEndWithNoTransformation: () => [ subIssuesHeader, [ generateListItem(subIssue)] ]
  };

  return mdRenderer(macroIssue.body || '', visitors);
}

// processors
function processSubIssuesParagraph(repoName, issue) {
  const isSubIssue = startsWith(issue.body, '← #');
  const [, parentIssueNumber] = issue.body.match(/← #(\d+)/) || [];

  if (isSubIssue && parentIssueNumber) {
    reviewStateLog(`Updating sub-issues paragraph in issue #${parentIssueNumber} from repo ${repoName}`);
    const { github, org, name } = configForRepo(repoName);

    github.repos(org, name).issues(parentIssueNumber).fetch()
      .then(macroIssue => {
        const newBody = includes(macroIssue.body, MD_TITLE) ?
          patchSubIssuesParagraph(macroIssue, issue) :
          generateSubIssuesParagraph(macroIssue, issue);

        updateIssueBody(repoName, newBody, macroIssue);
      })
      .catch(httpLog);
  }
}


export default subject => {
  subject
    .filter(({ body: { issue } }) => issue)
    .subscribe(({ body: { issue, repository: repo } }) => {
      prettifierLog(`Updating macro issue of issue #${issue.number} in repo ${repo.name}`);
      processSubIssuesParagraph(repo, issue, subject);
    });
};
