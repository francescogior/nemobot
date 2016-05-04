import Octokat from 'octokat';
import debug from 'debug';
import { find } from 'lodash';
import config from './config.js';


export const prettifierLog = debug('prettifier');
export const reviewStateLog = debug('prettifier:review state');
export const labelsLog = debug('prettifier:labels');
export const httpLog = x => debug('http')(JSON.stringify(x, null, 2));

export function configForRepo(name) {
  const { org, token, repos, apiURL } = config;
  const repo = find(repos, { name });
  return {
    name,
    org: repo && repo.org || org,
    github: new Octokat({
      token: repo && repo.token || token,
      rootURL: repo && repo.apiURL || apiURL
    })
  };
}
