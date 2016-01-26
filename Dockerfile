FROM node:5.5

COPY . /srv/app

WORKDIR /srv/app

RUN npm i
RUN npm run build

CMD npm run start
