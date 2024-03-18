FROM node:8-alpine

# - Upgrade alpine packages to avoid possible os vulnerabilities
# - Tini for Handling Kernel Signals https://github.com/krallin/tini
#   https://github.com/nodejs/docker-node/blob/master/docs/BestPractices.md#handling-kernel-signals
RUN apk --no-cache upgrade && apk add --no-cache tini git bash nano

WORKDIR /opt/arena

RUN git clone https://github.com/bee-queue/arena.git --branch v2.8.1 /opt/arena

RUN npm install

RUN npm ci --production && npm cache clean --force

EXPOSE 4567

USER node

ENTRYPOINT ["/sbin/tini", "--"]

CMD ["npm", "start"]
