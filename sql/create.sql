CREATE TABLE users (
   userid TEXT PRIMARY KEY,
   rating NUMERIC
);

CREATE TABLE ratings (
  userid TEXT,
  rater TEXT,
  rating NUMERIC,
  time TIME
);

CREATE INDEX on ratings(
   userid,
   time DESC
)

