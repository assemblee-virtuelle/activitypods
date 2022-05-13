const CommentService = require('./services/comment');

const CommentsApp = {
  name: 'comments',
  created() {
    this.broker.createService(CommentService);
  }
};

module.exports = CommentsApp;
