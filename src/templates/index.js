import fs from 'fs';
import querystring from 'querystring';
import { prettifierLog } from '../utils';
import { omit, omitBy } from 'lodash';

const bugTemplate = fs.readFileSync('./templates/bug.md').toString();
const featureTemplate = fs.readFileSync('./templates/feature.md').toString();
const defectTemplate = fs.readFileSync('./templates/defect.md').toString();
const subIssueTemplate = fs.readFileSync('./templates/sub-issue.md').toString();
const PRTemplate = fs.readFileSync('./templates/pr.md').toString();

const title = '[{topic}] {title}';


function addComputedQuery(templateObj) {
  const { labels = [], ..._others } = templateObj;
  const others = omitBy(_others, x => !x);

  return {
    ...templateObj,
    computedQuery: `${querystring.stringify(others)}${[].concat(labels).map(l => `&labels[]=${l}`).join('')}`
  };
}

function replaceVariablesInBody(body, query) {
  const variableKeys = Object.keys(omit(query, ['t', 'milestone', 'labels', 'assignee', 'topic']));
  return [body, ...variableKeys].reduce((body, k) => body.replace(RegExp(`\\$${k}`, 'g'), query[k]));
}

const getGithubQuery = ({ milestone, labels, assignee }) => ({ milestone, labels, assignee });

function getStandard(query) {
  return {
    ...getGithubQuery(query),
    title,
    titleSelection: '{topic}'
  };
}

function getBug({ labels = [], ...query }) {
  return {
    ...getGithubQuery(query),
    title,
    titleSelection: '{topic}',
    labels: ['bug', ...[].concat(labels)],
    body: replaceVariablesInBody(bugTemplate, query)
  };
}

function getFeature(query) {
  return {
    ...getGithubQuery(query),
    title,
    titleSelection: '{topic}',
    body: replaceVariablesInBody(featureTemplate, query)
  };
}

function getDefect({ labels = [], ...query }) {
  return {
    ...getGithubQuery(query),
    title,
    titleSelection: '{topic}',
    labels: ['defect', ...[].concat(labels)],
    body: replaceVariablesInBody(defectTemplate, query)
  };
}

function getSubIssue({ topic, ...query }) {
  return {
    ...getGithubQuery(query),
    title: topic ? `[${topic}] {title}` : title,
    titleSelection: topic ? '{title}' : '{topic}',
    body: replaceVariablesInBody(subIssueTemplate, query)
  };
}

function getPR(query) {
  return {
    body: replaceVariablesInBody(PRTemplate, query)
  };
}

export default (query) => {
  prettifierLog('Serving templates');
  const templates = {
    bug: addComputedQuery(getBug(query)),
    defect: addComputedQuery(getDefect(query)),
    feature: addComputedQuery(getFeature(query)),
    subIssue: addComputedQuery(getSubIssue(query)),
    standard: addComputedQuery(getStandard(query)),
    pr: addComputedQuery(getPR(query))
  };

  const allTemplates = !templates[query.t];
  return allTemplates ? templates : { [query.t]: templates[query.t] };
};
