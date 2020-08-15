### Build
FROM node:12.18 AS build

RUN groupadd dockeruser && useradd --no-log-init --gid dockeruser --create-home dockeruser
USER dockeruser:dockeruser

RUN mkdir /home/dockeruser/src
WORKDIR /home/dockeruser/src

COPY \
    package.json \
    package-lock.json \
    ./
RUN npm install

COPY src ./src/
COPY \
    index.html \
    rollup.config.js \
    tsconfig.json \
    ./
RUN npm run build


### Run
FROM nginx:stable AS run
COPY --from=build /home/dockeruser/src/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
