-- keyspace 생성
CREATE KEYSPACE IF NOT EXISTS place
WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 3}
AND durable_writes = true;

-- keyspace 선택
USE place;

-- 테이블 생성
CREATE TABLE IF NOT EXISTS place.pixel_history (
  x int,
  y int,
  timestamp timestamp,
  user_id text,
  color_index tinyint,
  PRIMARY KEY ((x, y), timestamp)
) WITH CLUSTERING ORDER BY (timestamp DESC)
AND compaction = {'class': 'TimeWindowCompactionStrategy', 
                'compaction_window_unit': 'DAYS', 
                'compaction_window_size': 7}
AND gc_grace_seconds = 86400;

CREATE TABLE IF NOT EXISTS place.board_snapshots (
  snapshot_id uuid,
  timestamp timestamp,
  board blob,
  PRIMARY KEY (snapshot_id)
);

CREATE TABLE IF NOT EXISTS place.user_stats (
  user_id int,
  pixels_placed counter,
  PRIMARY KEY (user_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS ON place.board_snapshots (timestamp); 