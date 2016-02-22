function getLabelsDefinitions() {
  return Rx.Observable.fromPromise(
    request({
      url: config.labelsTemplate,
      headers: { Authorization: `token ${config.token}` }
    })
  ).map(data => JSON.parse(data));
}

function upsertLabelInRepo(repoName, label) {
  const { github, org, name } = configForRepo(repoName);

  return github.repos(org, name).labels(label.name).fetch().then(() => {
    labelsLog(`Updating label [${label.name}] (#${label.color}) in repo ${repoName}`);
    github.repos(org, name).labels(label.name).update(label);
  }, () => {
    labelsLog(`Creating label [${label.name}] (#${label.color}) in repo ${repoName}`);
    github.repos(org, name).labels.create(label);
  });
}

function ensureLabelsConsistency(repoName, labels) {
  labels.forEach(label => {
    if (!label.whitelist || includes(label.whitelist, repoName)) {
      upsertLabelInRepo(repoName, label);
    }
  });
}
