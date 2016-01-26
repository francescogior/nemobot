#! /bin/zsh

set -e
set -x

if [ ! -e ../config.json ]; then
  echo "A config.json file needs to be available in the project directory" 1>&2
fi

LAST_COMMIT=$(git rev-parse HEAD)

docker build -t quay.io/buildo/github-prettifier:$LAST_COMMIT ..
docker tag -f quay.io/buildo/github-prettifier:$LAST_COMMIT quay.io/buildo/github-prettifier:latest
docker push quay.io/buildo/github-prettifier:$LAST_COMMIT quay.io/buildo/github-prettifier:latest

