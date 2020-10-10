CREATE TABLE users (
   userid TEXT PRIMARY KEY,
   sumRating NUMERIC,
   numRatings NUMERIC
);

CREATE TABLE ratings (
  userid TEXT,
  rater TEXT,
  rating NUMERIC,
  time TIMESTAMP
);

CREATE INDEX on ratings(
   userid,
   time DESC
)