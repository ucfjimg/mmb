const { Pool } = require('pg')
const pool = new Pool({connectionString: process.env.DATABASE_URL})

const DEFAULT_RATING = 0

async function ensureUser(userid) {
   const client = await pool.connect()

   try {
      await client.query('BEGIN')
      const res = await client.query(
         'SELECT userid FROM users WHERE userid=$1', [userid]
      )
      if (res.rowCount == 0) {
         await client.query(
            'INSERT INTO users (userid, sumrating, numratings, numsessionratings) VALUES ($1, $2, $3, $4)',
            [userid, DEFAULT_RATING, 0, 0]
         )
      }
      client.query('COMMIT')
   } catch (e) {
      console.warn(e)
      await client.query('ROLLBACK')
   } finally {
      client.release()
   }
}

// addRating - Adds the rating to the database and user profile.
async function addRating(rater, ratee, rating) {
   // Make sure the ratee is in the user database.
   await ensureUser(ratee)

   // Connect to the DB.
   const client = await pool.connect()

   try {
      await client.query('BEGIN')
      // Add this rating to the ratings table.
      await client.query(
         'INSERT INTO ratings (userid, rater, rating, time) VALUES ($1, $2, $3, now())',
         [ratee, rater, rating]
      )
      console.log("Rating added.");

      // Get the ratee's record. It should be present since ensureUser was called earlier.
      const res = await client.query(
         'SELECT sumrating, numratings, numsessionratings FROM users WHERE userid=$1', [ratee]
      )

      // Get the rating sum and number of ratings,
      // then modify them in accordance with the new rating.
      const curSum = parseInt(res.rows[0].sumrating);
      const curNumRatings = parseInt(res.rows[0].numratings);
      const curNumSessionRatings = parseInt(res.rows[0].numsessionratings);
      await client.query(
         'UPDATE users SET sumrating=$1, numratings=$2, numsessionratings=$3 WHERE userid=$4',
         [curSum + rating, curNumRatings + 1, curNumSessionRatings + 1, ratee]
      )
      await client.query('COMMIT')
   } catch (e) {
      await client.query('ROLLBACK')
      console.warn(e)
   } finally {
      client.release()
   }
}

// getNumRatings - Returns the number of ratings associated with userid.
async function getNumRatings(userid) {
   // Connect to the DB.
   const client = await pool.connect()

   try {
      // Get the user's ratings info.
      const res = await client.query(
         'SELECT numratings FROM users WHERE userid=$1', [userid]
      )
      // If the user is in the DB, calculate the mean and return.
      // Otherwise, provide the default rating (0).
      if (res.rowCount !== 0) {
         console.log(`Returning the number of ratings for user ID ${userid}`)
         return parseInt(res.rows[0].numratings);
      }
      return 0 
   } catch (e) {
      console.warn(e)
      await client.query('ROLLBACK')
   } finally {
      client.release()
   }
}

// getNumSessionRatings - Returns the number of ratings associated with userid's session.
async function getNumSessionRatings(userid) {
   // Connect to the DB.
   const client = await pool.connect()

   try {
      // Get the user's ratings info.
      const res = await client.query(
         'SELECT numsessionratings FROM users WHERE userid=$1', [userid]
      )
      // If the user is in the DB, calculate the mean and return.
      // Otherwise, provide the default rating (0).
      if (res.rowCount !== 0) {
         console.log(`Returning the number of session ratings for user ID ${userid}`)
         return parseInt(res.rows[0].numsessionratings);
      }
      return DEFAULT_RATING
   } catch (e) {
      console.warn(e)
      await client.query('ROLLBACK')
   } finally {
      client.release()
   }
}

// getRating - Calculate the user's current rating.
async function getRating(userid) {
   // Connect to the DB.
   const client = await pool.connect()

   try {
      // Get the user's ratings info.
      const res = await client.query(
         'SELECT sumrating, numratings FROM users WHERE userid=$1', [userid]
      )
      // If the user is in the DB, calculate the mean and return.
      // Otherwise, provide the default rating (0).
      if (res.rowCount !== 0) {
         console.log(res.rows[0])
         const curSum = parseInt(res.rows[0].sumrating);
         const curNumRatings = parseInt(res.rows[0].numratings);
         
         console.log(`getRating ${curSum} / ${curNumRatings} = ${curSum/curNumRatings}`)
         return curSum / curNumRatings;
      }
      return DEFAULT_RATING
   } catch (e) {
      console.warn(e)
      return DEFAULT_RATING
   } finally {
      client.release()
   }
}

async function getLastRatingTime(rater, ratee) {
   const client = await pool.connect()

   try {
      const res = await client.query(
         'SELECT time FROM ratings WHERE rater=$1 AND userid=$2 ORDER BY time DESC LIMIT 1', [rater, ratee]
      )
      if (res.rows.length == 0) {
         return null
      }
      return res.rows[0].time
   } catch (e) {
      console.warn(e)
      return null
   } finally {
      client.release()
   }
}

async function getLeaderboard() {
   const client = await pool.connect()

   try {
      const res = await client.query(
         'SELECT userid, sumrating, numratings FROM users ORDER BY sumrating / numratings DESC LIMIT 5'
      )
      return res.rows.map(row => { return {
         userid: row.userid,
         rating: parseInt(row.sumrating) / parseInt(row.numratings)
      }})

      return res.rows
   } catch (e) {
      console.warn(e)
      return null
   } finally {
      client.release()
   }
}

// kickUser - Reset numSessionRatings to zero. When they rejoin the server,
//            they are safe from kicking until it reaches the threshold again.
async function kickUser(userid) {
   // Connect to the DB.
   const client = await pool.connect()

   try {
      // Set numsessionratings to 0.
      const res = await client.query(
         'UPDATE users SET numsessionratings=0 WHERE userid=$1', [userid]
      )
   } catch (e) {
      console.warn(e)
      await client.query('ROLLBACK')
   } finally {
      client.release()
   }
}

exports.addRating = addRating
exports.getNumRatings = getNumRatings
exports.getNumSessionRatings = getNumSessionRatings
exports.getRating = getRating
exports.kickUser = kickUser
exports.getLastRatingTime = getLastRatingTime
exports.getLeaderboard = getLeaderboard
