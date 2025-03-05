-- keyspace 생성 (NetworkTopologyStrategy로 변경)
CREATE KEYSPACE IF NOT EXISTS place
WITH replication = {
    'class': 'NetworkTopologyStrategy', 
    'datacenter1': 3
}
AND durable_writes = true;

-- keyspace 선택
USE place;

-- 테이블 1: pixel_history (수정)
CREATE TABLE IF NOT EXISTS place.pixel_history (
    x int,
    y int,
    timestamp timestamp,
    user_id text,
    color_index tinyint,
    PRIMARY KEY ((x, y), timestamp, user_id)  // 복합 기본 키 수정
) WITH CLUSTERING ORDER BY (
    timestamp DESC, 
    user_id ASC
)
AND compaction = {
    'class': 'TimeWindowCompactionStrategy', 
    'compaction_window_unit': 'DAYS', 
    'compaction_window_size': 7
}
AND gc_grace_seconds = 86400;

-- 테이블 2: board_snapshots (수정)
CREATE TABLE IF NOT EXISTS place.board_snapshots (
    timestamp timestamp,
    snapshot_id uuid,
    board blob,
    PRIMARY KEY ((timestamp), snapshot_id)  // 복합 파티션 키 추가
) WITH CLUSTERING ORDER BY (snapshot_id ASC)
AND compaction = {
    'class': 'TimeWindowCompactionStrategy', 
    'compaction_window_unit': 'DAYS', 
    'compaction_window_size': 7
};

-- 테이블 3: user_stats (유지)
CREATE TABLE IF NOT EXISTS place.user_stats (
    user_id text,
    pixels_placed counter,
    PRIMARY KEY (user_id)
);