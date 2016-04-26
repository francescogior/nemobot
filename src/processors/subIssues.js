import { includes, find, startsWith } from 'lodash';
import {
  httpLog,
  prettifierLog,
  reviewStateLog,
  configForRepo
} from '../utils';
import mdRenderer from '../md-renderer';
import { isSubIssueEvent, subIssueValidArrows } from '../validators';

const TITLE = 'sub-issues';
const MD_TITLE = `## ${TITLE}`;

// utils
function getParentIssueNumber(issue) {
  const usedArrow = find(subIssueValidArrows, arrow => startsWith(issue.body, `${arrow} #`));
  const parentIssueNumberRegExp = new RegExp(`${usedArrow} #(\\d+)`);
  const [, parentIssueNumber] = issue.body.match(parentIssueNumberRegExp) || [];
  return parentIssueNumber;
}

function updateIssueBody(repoName, body, issue) {
  const { github, org, name } = configForRepo(repoName);
  github.repos(org, name).issues(issue.number).update({ body: body.replace(/\n\n+/g, '\n\n').trim() }); // max one empty line
}

function generateListItem({ state, title, number }) {
  const isOpen = state === 'open';
  return {
    type: 'listitem',
    text: [ `[${isOpen ? ' ' : 'x'}] ${title.replace(/\[[^\]]+\]/, '').trim()} #${number}` ]
  };
}

function generateList(issue) {
  return {
    type: 'list',
    body: [generateListItem(issue)],
    ordered: false
  };
}

function patchSubIssuesParagraph(macroIssue, subIssue) {
  const shouldReplaceListItem = (listItem) => find(listItem.text, x => includes(x, `#${subIssue.number}`));

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
    onEndWithNoTransformation: () => [ subIssuesHeader, [ generateList(subIssue)] ]
  };

  return mdRenderer(macroIssue.body || '', visitors);
}

// processors
function processSubIssuesParagraph(repo, issue, onNext) {
  const parentIssueNumber = getParentIssueNumber(issue);
  if (parentIssueNumber) {
    reviewStateLog(`Updating sub-issues paragraph in issue #${parentIssueNumber} from repo ${repo.name}`);
    const { github, org, name } = configForRepo(repo.name);

    github.repos(org, name).issues(parentIssueNumber).fetch()
      .then(macroIssue => {
        const newBody = includes(macroIssue.body, MD_TITLE) ?
          patchSubIssuesParagraph(macroIssue, issue) :
          generateSubIssuesParagraph(macroIssue, issue);

        updateIssueBody(repo.name, newBody, macroIssue);
        const fakeWebhook = {
          event: 'issues',
          body: { issue: { ...macroIssue, body: newBody }, repository: repo }
        };
        onNext(fakeWebhook);
      })
      .catch(httpLog);
  }
}

export default ({ subject, onNext }) => {
  subject
    .filter(isSubIssueEvent)
    .subscribe(({ body: { issue, repository: repo } }) => {
      prettifierLog(`Updating macro issue of issue #${issue.number} in repo ${repo.name}`);
      processSubIssuesParagraph(repo, issue, onNext);
    });
};
