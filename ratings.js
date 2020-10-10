const db = require('./mmbdb')


async function getRating(userid) {
   return db.getRating(userid)
}

exports.getRating = getRating
