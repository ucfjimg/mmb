const { Pool } = require('pg')
const pool = new Pool({connectionString: process.env.DATABASE_URL})

const DEFAULT_RATING = 3

async function ensureUser(userid) {
   const client = await pool.connect()

   try {
      await client.query('BEGIN')
      const res = await client.query(
         'SELECT rating FROM users WHERE userid=$1', [userid]
      )
      if (res.rowCount == 0) {
         await client.query(
            'INSERT INTO users (userid, rating) VALUES ($1, $2)',
            [userid, DEFAULT_RATING]
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

async function addRating(rater, ratee, rating) {
   await ensureUser(ratee)

   const client = await pool.connect()

   try {
      await client.query(
         'INSERT INTO ratings (userid, rater, rating, time) VALUES ($1, $2, $3, now())',
         [ratee, rater, rating]
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
