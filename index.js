require('dotenv').config()
const fs = require('fs')
const eris = require('eris')
const db = require('./mmbdb')
const ratings = require('./ratings')

const bot = new eris.Client(process.env.token)

const PREFIX = 'b!'
const MIN_RATING_TO_KICK = 1.5
const MIN_NUMRATINGS_TO_KICK = 10
const DEFAULT_RATING_TIMEOUT = 3600

const commandHandlers = {};

// Get the URL for a cat image
//
function catUrl(rating) {
   return `http://rodentia.net/mmb${rating}.png`;
}

// Get the cat emojis if they've been put up
//
function catEmoji(msg) {
   const emojis = []

   for (let i = 0; i <= 5; i++) {
      const name = `mmbcat${i}`

      const emoji = msg.channel.guild.emojis.filter(e => e.name === name)
      if (emoji.length === 1) {
         emojis.push(`<:${name}:${emoji[0].id}>`)
      }
   }
   
   if (emojis.length == 6) {
      return emojis
   }

   return null
}

// Format a rating 
// 
function formatRating(rating) {
   // rating.toFixed(2) rounds the value to 2 decimal places.
   return rating.toFixed(2)
}

// Create a message for an error message (including the worst cat)
//
function errorCard(msg, error, title) {
   return msg.channel.createMessage({
      embed: {
         thumbnail: {
            url: catUrl(1)
         },
         title: title || 'Whoops!',
         description: `<@${msg.author.id}> did something wrong and will be docked one MeowMeowBeen (not really). ${error}`
      }
   })
}

// Create a message when a user is kicked for a low rating.
function kickedCard(msg, user, newRating, avgRating, numRatings) {
   const png = `http://rodentia.net/mmb0.png`;
   return msg.channel.createMessage({
      embed: {
         thumbnail: {
            url: png
         },
         title: `A user has been removed.`,
         description: `With ${numRatings} ratings, a recent score of ${newRating},
                       and an average score of ${avgRating.toFixed(2)}, <@!${user}> has been kicked from the server.
                       \nPlease keep in mind that this is not a ban; they can rejoin if they still have the server link.
                       \nIf they rejoin, their score will not be reset. However, they will not be removed until they have received ${MIN_NUMRATINGS_TO_KICK} more ratings.`
      }
   })
}

// Create a message when a user's rating has changed due to another user
function ratedCard(msg, rater, ratee, given, avgRating) {
   return msg.channel.createMessage({
      embed: {
         thumbnail: {
            // Math.round(rating) rounds the rating to the nearest whole number.
            url: catUrl(Math.round(avgRating))
         },
         title: 'Attention!',
         description: `<@!${rater}> has given <@!${ratee}> a rating of ${given}.
                        <@!${ratee}>\'s new rating is ${formatRating(avgRating)}.`
      }
   })
}

// Create a generic rating card
function ratingCard(msg, user, rating) {
   return msg.channel.createMessage({
      embed: {
         thumbnail: {
            // if no rating, use 3 -- neutral
            url: catUrl(rating === 0 ? 3 : Math.round(rating))
         },
         title: 'Here\'s the tea!',
         description: 
            rating === 0 
               ? `<@!${user}> is not yet rated.`
               : `<@!${user}> has a rating of ${formatRating(rating)}.`
      }
   })
}

// Create a leaderboard card
//
function leaderboardCard(msg, leaders) {
   const cats = catEmoji(msg)

   // This should really have the proper cat icon by each place, but
   // fields don't support images other than existing emoji
   //
   const fields = leaders.map((leader, n) => { 
      return { 
         name: n+1, 
         value: `${cats ? cats[(Math.round(leader.rating))] : ''}<@!${leader.userid}> : ${formatRating(parseFloat(leader.rating))}`  
      }
   })

   return msg.channel.createMessage({
      embed: { 
         thumbnail: {
            url: catUrl(5)
         },
         title: 'The Purrfect People',
         fields 
      }
   })
}

// Create a help card
//
function helpCard(msg) {
   const fields = [
      { name: 'Overview', value:
         'MeowMeowBeenz is a social rating app where rate each other on ' +
         'a scale of 1 to 5. This insidious idea is hidden behind a facade of ' +
         'brightly colored cats, representing the ratings -- gold, silver, bronze, ' +
         'yellow, and red, in order of decreasing rank.\n\n' + 
         'Credit for the idea of MeowMeowBeenz goes to the TV show Community, in which it ' +
         'basically destroyed civilization.'
      },
      { name: 'board', value:
         'Displays a leaderboard of the people with the top scores on the server. ' +
         'These people are your betters, and you must (if they ask) wash their cars.'
      },
      { name: 'me', value:
         'Sends a card with your own rating, for you and the world to see.'
      },
      { name: 'ping', value:
         'Tests that the bot server is alive.'
      },
      { name: 'rate <mention> 1,2,3,4,5', value: 
         'Gives a user a rating. Ratings are cumulative, and you can rate someone else ' +
         'more than once. 5 is good and 1 is bad. Ratings are not anonymous.'
      },
      { name: 'tea <mention>', value:
         'Sends a card with someone else\'s rating, for you and the world to see.'
      }
   ]

   return msg.channel.createMessage({
      embed: { 
         thumbnail: {
            url: catUrl(5)
         },
         title: 'Help!',
         fields
      }
   })

}

// Determine if the given token is a user snowflake
//
function parseUserSnowflake(str) {
   if (str.length == 0 || str[str.length-1] != '>') {
      return null;
   }

   str = str.substr(0, str.length-1);

   if (str.substr(0, 2) == '<!') {
      // username 
      str = str.substr(2);
   } else if (str.substr(0, 3) == '<@!') {
      // nickname
      str = str.substr(3);
   } else {
      // not a user snowflake
      return null
   }

   return str;
}

commandHandlers['mkemoji'] = async(msg, args) => {
   console.log(msg.channel.guild.id)
   console.log(msg.channel.guild.roles)
}

// the help command
commandHandlers['help'] = async (msg, args) => {
   return helpCard(msg)
}

// the rate command - allows one use to rate another
commandHandlers['rate'] = async (msg, args) => {
   // Verify right # of args
   if (args.length != 2) {
      return errorCard(msg, 'Rate needs a mention and a rating.');
   }

   rater = msg.author.id;
   ratee = parseUserSnowflake(args[0]);

   // verify target is a user
   if (ratee == null) {
      return errorCard(msg, 'You need to mention someone to rate.')
   }

   // verify user not trying to up themselves
   if (rater === ratee) {
      return errorCard(msg, 'You can\'t rate yourself!')
   }

   // verify rating is ok
   const rating = parseInt(args[1])
   if (args[1].length != 1 || isNaN(rating) || rating < 1 || rating > 5) {
      return errorCard(msg, "Rating must be a number from 1 to 5.")
   }

   console.log(`${rater} wants to rate ${ratee} as ${rating}`)

   // enforce rating timeout
   const last = await db.getLastRatingTime(rater, ratee);
   if (last != null) {
      // difference is in milliseconds, we need seconds
      const seconds = (new Date() - last) / 1000.0
      const timeout = process.env.rating_timeout || DEFAULT_RATING_TIMEOUT

      if (seconds <= timeout) {
         const left = timeout - seconds
         const leftText = 
            left >= 120 ?
               `${Math.floor(left/60)} minutes` :
               `${Math.floor(left)} seconds`


         return errorCard(msg, `You need to wait another ${leftText} before rating <@!${ratee}> again.`, 'Whoa There!')
      }
   }

   await db.addRating(rater, ratee, rating)

   // Wait for the average rating so the card doesn't recieve an object promise.
   const avgRating = await db.getRating(ratee);
   console.log(`Now the rating is ${avgRating}`);

   // If the new rating and average rating are too low, check the number of ratings.
   // If there are enough ratings, kick the user.
   if(rating < MIN_RATING_TO_KICK && avgRating < MIN_RATING_TO_KICK)
   {
      const numRatings = await db.getNumSessionRatings(ratee);
      if(numRatings >= MIN_NUMRATINGS_TO_KICK)
      {
         // Kick the member associated with the user ID.
         msg.channel.guild.kickMember(ratee, 'Score was below threshold.');
         db.kickUser(ratee);
         return kickedCard(msg, ratee, rating, avgRating, await db.getNumRatings(ratee));
      }
   }

   return ratedCard(msg, rater, ratee, rating, avgRating)
}

// Test connectivity to the bot
//
commandHandlers['ping'] = async (msg, args) => {
   console.log(`guild id ${msg.channel.guild.id}`)
   console.log(msg.channel.guild.emojis)
   console.log(catEmoji(msg))
   return msg.channel.createMessage({
      embed: {
         thumbnail: {
            url: catUrl(5)
         },
         title: 'Meow!',
         description: 'I\'m here and paying attention. Are you?'
      }
   })
}

// Give me my stats
//
commandHandlers['me'] = async (msg, args) => {
   const myRating = await ratings.getRating(msg.author.id)

   return ratingCard(msg, msg.author.id, myRating)
}

// Give me someone else's stats
//
commandHandlers['tea'] = async (msg, args) => {
   if (args.length != 1) {
      return errorCard(msg, 'Tea requires someone to snoop on.');
   }

   ratee = parseUserSnowflake(args[0]);

   if (ratee == null) {
      return errorCard(msg, 'You need to mention someone.')
   }

   const teaRating = await ratings.getRating(ratee)
   console.log(teaRating)

   return ratingCard(msg, ratee, teaRating)
}

// Return the leaderboard
//
commandHandlers['board'] = async (msg, args) => {
   const leaders = await db.getLeaderboard()

   return leaderboardCard(msg, leaders)
}

// When the bot comes online
//
bot.on('ready', () => {
   console.log('connected and ready')
})

// When any message is sent
//
bot.on('messageCreate', async (msg) => {
   const content = msg.content

   // Ensure the message is a server message
   if (!msg.channel.guild) {
      return
   }

   // Ensure the message is targeted at the bot
   if (!content.startsWith(PREFIX)) {
      return
   }
   console.log(`content ${content}`)

   // Parse the message and dispatch it
   const parts = content.split(' ').map(s => s.trim()).filter(s => s)
   const commandName = parts[0].substr(PREFIX.length)
   const handler = commandHandlers[commandName]
   if (!handler)
      return;

   const args = parts.slice(1)
   try {
      await handler(msg, args)
   } catch (err) {
      console.warn('Error handling command')
      console.warn(err)
   }
})

bot.on('error', err => {
   console.warn(err)
})

bot.connect()

