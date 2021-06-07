const TwitterClient = require('twitter-api-client')
const twitter = new TwitterClient.TwitterClient({
  apiKey: process.env.TWITTER_API_KEY,
  apiSecret: process.env.TWITTER_API_KEY_SECRET,
  accessToken: process.env.TWITTER_API_ACCESS_TOKEN,
  accessTokenSecret: process.env.TWITTER_API_ACCESS_TOKEN_SECRET
})
const mockTweets = require('./../mocks/tweets')

const doResponse = (statusCode, body) => {
  return {
    statusCode,
    headers:  {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTION"
    },
    body: JSON.stringify(body)
  }
}

exports.handler = async event => {
  const listId = event.queryStringParameters.listId || '976556889981906945'

  if (listId === 'all') {
    return doResponse(200, mockTweets)
  }

  let twitterError = false
  const tweets = []

  const twitterRequest = await twitter.accountsAndUsers.listsStatuses({
    list_id: listId,
    count: 200
  }).catch(error => {
    twitterError = error
    console.error('Twitter API error: ', error.data)
  })

  if (twitterError) {
    const errorData = JSON.parse(twitterError.data).errors[0]
    const errorMessage = errorData.code.toString() === '112'
      ? 'Twitter API: Invalid Twitter List ID'
      : 'Twitter API Error'
    return doResponse(twitterError.statusCode, { error: errorMessage })
  }

  twitterRequest.forEach((tweet, i) => {
    const { id, text, source, user } = tweet
    try {
      let mediaUrl = tweet.entities.media[0].media_url
      let isVideo = null
      let isGif = null
      if (mediaUrl) {
        isVideo = mediaUrl.match('ext_tw_video_thumb')
        isGif = mediaUrl.match('video_thumb')
        if (isVideo) {
          mediaUrl = tweet.extended_entities.media[0].video_info.variants[0].url
        } else if (isGif) {
          isVideo = true
          mediaUrl = tweet.extended_entities.media[0].video_info.variants[0].url
        }

        tweets.push({
          id,
          text,
          source,
          mediaUrl,
          isVideo: !!isVideo,
          isImage: !isVideo,
          user: user.screen_name,
          media: tweet.entities.media,
          size: tweet.entities.media[0].sizes.large
        })
      }
    } catch (error) {
      // ignore error...
      // it seems we are running node 12 and can't use optional chaining, ergo this try/catch
    }
  })

  return doResponse(200, tweets)
}
