FROM node:14-alpine AS build

WORKDIR /usr/src/app
COPY package.json yarn.lock /usr/src/app/
RUN yarn install
ADD . /usr/src/app
RUN yarn run tsc

FROM node:14-alpine AS production
WORKDIR /usr/src/app
COPY package.json yarn.lock /usr/src/app/
RUN yarn install --production
COPY --from=build /usr/src/app/dist /usr/src/app
COPY --from=build /usr/src/app/assets /usr/src/app/assets
CMD [ "node", "src/index.js" ]
