const config = require('config');
const slack = require('slack-notify')(config.slack.webhook_url);

module.exports = function() {
  // Overrides the ghastly defaults provided by the library - the webhook integration has these built iin!
  slack.notify  = function(message) {
    if (config.environment != 'production') {
      message = '[DEV] ' + message
    }
    return slack.send({ channel: '', icon_emoji: '', username: '', text: message})
  }
  return slack
}