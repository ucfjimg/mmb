CREATE TABLE users (
   userid TEXT PRIMARY KEY,
   rating NUMERIC
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

