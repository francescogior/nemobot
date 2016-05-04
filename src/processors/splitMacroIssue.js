import { find, startsWith, filter } from 'lodash';
import { subIssueValidArrows, isSplitMacroIssueEvent } from '../validators';
import { prettifierLog, configForRepo } from '../utils';
import mdRenderer, { getSubIssuesList } from '../md-renderer';
import {
  updateIssueBody,
  getNewBodyWithUpdatedSubIssues
} from '../processors/subIssues';

function getIssue(repoName, issueNumber) {
  const { github, org, name } = configForRepo(repoName);
  return github.repos(org, name).issues(issueNumber).fetch();
}

function getSubIssues(repoName, macroIssue) {
  const subIssuesList = getSubIssuesList(macroIssue.body);
  return Promise.all(subIssuesList.body.map(listItem => {
    const regExp = /#(\d+)/;
    const text = find(listItem.text, x => (x.text || x).match(regExp));
    const [, subIssueNumber] = text.match(regExp) || [];
    return getIssue(repoName, subIssueNumber);
  }));
}

function createNewIssue(repoName, issue) {
  const { github, org, name } = configForRepo(repoName);

  const _issue = {
    ...issue,
    assignee: issue.assignee ? issue.assignee.login : null,
    milestone: issue.milestone ? issue.milestone.number : null,
    labels: issue.labels ? issue.labels.map(l => l.name).filter(l => l !== 'customers') : null
  };
  return github.repos(org, name).issues.create(_issue);
}

function removeSubIssuePragraph(repoName, macroIssue) {
  const visitors = {
    onSubissues: () => [] // remove sub-issues
  };

  const newBody = mdRenderer(macroIssue.body, visitors).replace('## sub-issues', '');
  return updateIssueBody(repoName, newBody, macroIssue);
}

function upsertSubIssueToMacro(repoName, macroIssue, subIssue) {
  const newBody = getNewBodyWithUpdatedSubIssues(macroIssue, subIssue);
  return updateIssueBody(repoName, newBody, macroIssue);
}

function upsertSubIssuesToMacro(repoName, macroIssue, subIssues) {
  const newBody = subIssues.reduce(
    (body, subIssue) => getNewBodyWithUpdatedSubIssues({ body }, subIssue),
    macroIssue.body
  );
  return updateIssueBody(repoName, newBody, macroIssue);
}

function getNewBodyWithUpdatedParent(subIssue, macroIssue) {
  const usedArrow = find(subIssueValidArrows, arrow => startsWith(subIssue.body, `${arrow} #`));

  if (usedArrow) {
    const regExp = new RegExp(`${usedArrow} #\\d+`);
    return subIssue.body.replace(regExp, `${usedArrow} #${macroIssue.number}`);
  } else {
    return `${subIssueValidArrows[0]} #${macroIssue.number}\n\n${subIssue.body}`;
  }
}

function upsertParentToSubIssue(repoName, subIssue, macroIssue) {
  const newBody = getNewBodyWithUpdatedParent(subIssue, macroIssue);
  return updateIssueBody(repoName, newBody, subIssue);
}

function upsertParentToSubIssues(repoName, subIssues, macroIssue) {
  return Promise.all(subIssues.map(subIssue => upsertParentToSubIssue(repoName, subIssue, macroIssue)));
}

async function populateNewMacroIssue(repoName, originalMacroIssueNumber, newMacroIssueNumber, subIssues) {
  const originalMacroIssue = await getIssue(repoName, originalMacroIssueNumber);
  const newMacroIssue = await getIssue(repoName, newMacroIssueNumber);
  await upsertSubIssueToMacro(repoName, originalMacroIssue, newMacroIssue);
  await upsertParentToSubIssue(repoName, newMacroIssue, originalMacroIssue);

  const updatedNewMacroIssue = await getIssue(repoName, newMacroIssueNumber);

  await upsertSubIssuesToMacro(repoName, updatedNewMacroIssue, subIssues);
  await upsertParentToSubIssues(repoName, subIssues, updatedNewMacroIssue);
}

async function createOpenAndClosedMacroIssues(repoName, originalMacroIssueNumber) {
  const originalMacroIssue = await getIssue(repoName, originalMacroIssueNumber);
  const openMacroIssue = await createNewIssue(repoName, originalMacroIssue);
  const closedMacroIssue = await createNewIssue(repoName, originalMacroIssue);

  const { github, org, name } = configForRepo(repoName);
  await github.repos(org, name).issues(closedMacroIssue.number).update({ state: 'closed' });

  return { openMacroIssue, closedMacroIssue };
}

async function splitMacroIssue(repoName, macroIssueNumber) {
  const originalMacroIssue = await getIssue(repoName, macroIssueNumber);

  const subIssues = await getSubIssues(repoName, originalMacroIssue);
  const openSubIssues = filter(subIssues, { state: 'open' });
  const closedSubIssues = filter(subIssues, { state: 'closed' });
  console.log('0');
  // remove sub-issues paragraph in originalMacroIssue to avoid conflicts
  await removeSubIssuePragraph(repoName, originalMacroIssue);
  console.log('1');
  const { openMacroIssue, closedMacroIssue } = await createOpenAndClosedMacroIssues(repoName, macroIssueNumber);
  console.log('2');
  // openMacroIssue
  await populateNewMacroIssue(repoName, macroIssueNumber, openMacroIssue.number, openSubIssues);
  console.log('3');
  // closedMacroIssue
  await populateNewMacroIssue(repoName, macroIssueNumber, closedMacroIssue.number, closedSubIssues);
  console.log('4');
}

export default ({ subject }) => {
  subject
    .filter(isSplitMacroIssueEvent)
    .subscribe(({ body: { macroIssueNumber, repoName } }) => {
      prettifierLog(`Splitting macro issue #${macroIssueNumber} in repo ${repoName}`);
      splitMacroIssue(repoName, macroIssueNumber);
    });
};
