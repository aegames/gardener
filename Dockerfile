FROM node:14-alpine

WORKDIR /usr/src/app
COPY package.json yarn.lock /usr/src/app/
RUN yarn install
ADD . /usr/src/app
RUN yarn run tsc
CMD [ "node", "dist/index.js" ]
