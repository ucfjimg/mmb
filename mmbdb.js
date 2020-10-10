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
            'INSERT INTO users (userid, sumrating, numratings) VALUES ($1, $2, $3)',
            [userid, DEFAULT_RATING, DEFAULT_RATING]
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
      // Add this rating to the ratings table.
      await client.query(
         'INSERT INTO ratings (userid, rater, rating, time) VALUES ($1, $2, $3, now())',
         [ratee, rater, rating]
      )
      console.log("Rating added.");

      // Get the ratee's record. It should be present since ensureUser was called earlier.
      const rateeEntry = await client.query(
         'SELECT * FROM users WHERE userid=$1', [ratee]
      )

      // Get the rating sum and number of ratings,
      // then modify them in accordance with the new rating.
      const curSum = parseInt(rateeEntry.rows[0].sumrating);
      const curNumRatings = parseInt(rateeEntry.rows[0].numratings);
      await client.query(
         'UPDATE users SET sumrating=$1, numratings=$2',
         [curSum + rating, curNumRatings + 1]
      )
   } catch (e) {
      console.warn(e)
   } finally {
      client.release()
   }
}

async function getRating(userid) {
   const client = await pool.connect()

   try {
      const res = await client.query(
         'SELECT rating FROM users WHERE userid=$1', [userid]
      )
      if (res.rowCount !== 0) {
         console.log(res.rows[0])
         return res.rows[0].rating
      }
      return DEFAULT_RATING
   } catch (e) {
      console.warn(e)
      await client.query('ROLLBACK')
   } finally {
      client.release()
   }
}

exports.addRating = addRating
exports.getRating = getRating
