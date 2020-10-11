require('dotenv').config()
const fs = require('fs')
const eris = require('eris')
const db = require('./mmbdb')
const ratings = require('./ratings')

const bot = new eris.Client(process.env.token)

const PREFIX = 'b!'
const MIN_RATING_TO_KICK = 1.5
const MIN_NUMRATINGS_TO_KICK = 10
const commandHandlers = {};

// Create a message for an error message (including the worst cat)
function errorCard(msg, error) {
   return msg.channel.createMessage({
      embed: {
         thumbnail: {
            url: 'http://rodentia.net/mmb1.png'
         },
         title: 'Whoops!',
         description: `<@${msg.author.id}> did something wrong and will be docked one MeowMeowBeen (not really). ${error}`
      }
   })
}

// Create a message when a user is kicked for a low rating.
function kickedCard(msg, user, newRating, avgRating, numRatings) {
   const png = `http://rodentia.net/mmb1.png`;
   return msg.channel.createMessage({
      embed: {
         thumbnail: {
            url: png
         },
         title: `A user has been removed.`,
         description: `With ${numRatings} ratings, a recent score of ${newRating},
                       and an average score of ${avgRating.toFixed(2)}, <@!${user}> has been kicked from the server.
                       \nPlease keep in mind that this is not a ban; they can rejoin if they still have the server link.
                       \nIf they rejoin, their score will not be reset. However, they will not be removed until they recieved ${MIN_NUMRATINGS_TO_KICK} more ratings.`
      }
   })
}

// Create a message when a user's rating has changed due to another user
function ratedCard(msg, rater, ratee, rating, avgRating) {
   // Math.round(rating) rounds the rating to the nearest whole number.
   const png = `http://rodentia.net/mmb${Math.round(rating)}.png`;
   return msg.channel.createMessage({
      embed: {
         thumbnail: {
            url: png
         },
         title: 'Attention!',
         // rating.toFixed(2) rounds the value to 2 decimal places.
         description: `<@!${rater}> has given <@!${ratee}> a rating of ${rating}.
                        <@!${ratee}>\'s new rating is ${avgRating.toFixed(2)}.`
      }
   })
}

// Create a generic rating card
function ratingCard(msg, user, rating) {
   const png = `http://rodentia.net/mmb${rating}.png`;
   return msg.channel.createMessage({
      embed: {
         thumbnail: {
            url: png
         },
         title: 'Here\s the tea!',
         description: `<@!${user}> has a rating of ${rating}.`
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
      str = str.substr(2);
   } else if (str.substr(0, 3) == '<@!') {
      str = str.substr(3);
   } else {
      return null;
   }

   return str;
}

commandHandlers['rate'] = async (msg, args) => {
   if (args.length != 2) {
      return errorCard(msg, 'Rate needs a mention and a rating.');
   }

   rater = msg.author.id;
   ratee = parseUserSnowflake(args[0]);

   if (ratee == null) {
      return errorCard(msg, 'You need to mention someone to rate.')
   }

   if (rater === ratee) {
      return errorCard(msg, 'You can\'t rate yourself!')
   }

   const rating = parseInt(args[1])
   if (args[1].length != 1 || isNaN(rating)) {
      return errorCard(msg, "Rating must be a number from 1 to 5.")
   }

   console.log(`${rater} wants to rate ${ratee} as ${rating}`)

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

commandHandlers['ping'] = async (msg, args) => {
   return msg.channel.createMessage({
      embed: {
         thumbnail: {
            url: 'http://rodentia.net/mmb5.png'
         },
         title: 'Meow!',
         description: 'I\'m here and paying attention. Are you?'
      }
   })
}

commandHandlers['me'] = async (msg, args) => {
   const myRating = await ratings.getRating(msg.author.id)

   return ratingCard(msg.author.id, myRating)
}

commandHandlers['tea'] = async (msg, args) => {
   if (args.length != 1) {
      return errorCard(msg, 'Tea requires someone to snoop on.');
   }

   ratee = parseUserSnowflake(args[0]);

   if (ratee == null) {
      return errorCard(msg, 'You need to mention someone.')
   }

   const teaRating = await ratings.getRating(ratee)

   return msg.channel.createMessage(`Their rating is ${teaRating}`)
}

bot.on('ready', () => {
   console.log('connected and ready')
})

bot.on('messageCreate', async (msg) => {
   const content = msg.content

   if (!msg.channel.guild)
      return

   //console.log(msg)
   //console.log(`content ${content}`)
   if (!content.startsWith(PREFIX))
      return

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

