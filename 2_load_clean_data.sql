-- SQL script to load the exact data set provided

-- Insert all entries with their exact data
INSERT INTO time_entries (
  id, user_id, date, description, client, project, hours, rate, amount, created_at, updated_at
) VALUES
  -- Entry 1
  (
    'c6b8bdab-13fd-4f61-be2c-9ecf6d42ef9b'::uuid,
    'c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid,
    '2025-04-11',
    'AI  taskforce meeting',
    'monigle',
    'ai training',
    1,
    350,
    350,
    '2025-04-10T23:13:03.735+00:00',
    '2025-04-10T23:13:03.906054+00:00'
  ),
  -- Entry 2
  (
    'a9543dd2-9f0c-4be5-8766-8fc23edc0714'::uuid,
    'c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid,
    '2025-04-10',
    'AI idea longlist prep and Copilot experimentation',
    'monigle',
    'ai training',
    3,
    350,
    1050,
    '2025-04-11T00:50:17.762+00:00',
    '2025-04-11T00:50:17.862503+00:00'
  ),
  -- Entry 3
  (
    'd47d4ec2-2900-4bb8-a48d-ce89e9173032'::uuid,
    'c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid,
    '2025-04-10',
    'AI taskforce tech meeting prep',
    'monigle',
    'ai training',
    2,
    350,
    700,
    '2025-04-10T21:16:44.886+00:00',
    '2025-04-10T21:16:45.454036+00:00'
  ),
  -- Entry 4
  (
    'ac530d18-77a1-43dd-9ac5-f71be6ed5763'::uuid,
    'c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid,
    '2025-04-08',
    'Growth/ Executive Team / and Gabriel meetings',
    'monigle',
    'ai training',
    1.15,
    350,
    402.5,
    '2025-04-08T00:35:45.677+00:00',
    '2025-04-08T00:35:45.924265+00:00'
  ),
  -- Entry 5
  (
    '89a6aac0-e761-4a77-9675-e69579dc0000'::uuid,
    'c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid,
    '2025-04-07',
    'Kick off meeting update and next steps  ',
    'monigle',
    'ai training',
    2,
    350,
    700,
    '2025-04-07T08:03:26.112+00:00',
    '2025-04-07T08:03:26.326476+00:00'
  ),
  -- Entry 6
  (
    '00968687-edb8-4d7e-9105-7ee080c5d677'::uuid,
    'c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid,
    '2025-04-04',
    'department kick off meetings, FandO',
    'monigle',
    'ai training',
    0.5,
    350,
    175,
    '2025-04-04T01:03:23.173+00:00',
    '2025-04-04T01:03:39.164582+00:00'
  ),
  -- Entry 7
  (
    'a70c8c49-12bd-47bc-9e97-7d0d0b2d1b96'::uuid,
    'c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid,
    '2025-04-03',
    'Font Waterful tool build',
    'monigle',
    'Implementation projects',
    1,
    350,
    350,
    '2025-04-03T02:06:57.854+00:00',
    '2025-04-03T02:06:58.083258+00:00'
  ),
  -- Entry 8
  (
    '4c68dad5-bd4b-4770-9806-3f1b08436704'::uuid,
    'c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid,
    '2025-04-03',
    'department kick off meetings expression /implementation',
    'monigle',
    'ai training',
    1,
    350,
    350,
    '2025-04-03T00:38:56.343+00:00',
    '2025-04-03T00:38:56.687735+00:00'
  ),
  -- Entry 9
  (
    '5a6f39a2-fb25-4478-b784-06d84e22282c'::uuid,
    'c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid,
    '2025-04-02',
    'the presentation building tool dev',
    'monigle',
    'ai training',
    2,
    350,
    700,
    '2025-04-03T02:05:51.491+00:00',
    '2025-04-03T02:05:52.220211+00:00'
  ),
  -- Entry 10
  (
    'a3fd4f3d-7921-4b17-856e-e4c94fd4de88'::uuid,
    'c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid,
    '2025-04-02',
    'department kick of meetings cx/insights',
    'monigle',
    'ai training',
    1,
    350,
    350,
    '2025-04-02T04:33:57.285344+00:00',
    '2025-04-03T00:32:24.564257+00:00'
  ),
  -- Entry 11
  (
    '2f91c9a5-d5c1-458b-84c7-fcfb5ec562a8'::uuid,
    'c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid,
    '2025-04-01',
    'department kick off meetings Strategy / Verbal',
    'monigle',
    'ai training',
    1,
    350,
    350,
    '2025-03-31T22:56:46.245832+00:00',
    '2025-04-03T00:31:57.798852+00:00'
  ),
  -- Entry 12
  (
    'cc84f367-1fd5-40f6-a89c-d914166d80f4'::uuid,
    'c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid,
    '2025-03-31',
    'preparing for first meetings',
    'monigle',
    'ai training',
    1,
    350,
    350,
    '2025-03-31T20:58:08.134719+00:00',
    '2025-03-31T20:58:08.134719+00:00'
  ),
  -- Entry 13
  (
    '0ac42269-a798-4b30-9b7e-e0df065547c7'::uuid,
    'c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid,
    '2025-03-14',
    'Intro presentation',
    'monigle',
    'ai training',
    1,
    350,
    350,
    '2025-03-19T00:56:52.871439+00:00',
    '2025-03-19T01:15:30.326992+00:00'
  ),
  -- Entry 14
  (
    '0d250082-5adf-4d64-a367-31ff3390ca4b'::uuid,
    'c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid,
    '2025-03-12',
    'Meeting with AI collective',
    'monigle',
    'ai training',
    0.5,
    350,
    175,
    '2025-03-19T00:56:52.60258+00:00',
    '2025-03-19T01:15:39.782451+00:00'
  ),
  -- Entry 15
  (
    '9852a0e1-a11b-41a6-919a-ec1f36059a2d'::uuid,
    'c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid,
    '2025-03-11',
    'Presentation development',
    'monigle',
    'ai training',
    8,
    350,
    2800,
    '2025-03-19T00:56:52.310203+00:00',
    '2025-03-19T01:15:46.13459+00:00'
  ),
  -- Entry 16
  (
    '841f3804-7d99-4e38-8af2-f28578cc980f'::uuid,
    'c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid,
    '2025-05-14',
    'Leadership meeting prep',
    'monigle',
    'ai training',
    1,
    350,
    350,
    '2025-04-15T02:12:59.489+00:00',
    '2025-04-15T02:12:59.882603+00:00'
  ),
  -- Entry 17
  (
    'edf87d2b-7261-407c-8d96-b6495347ddd2'::uuid,
    'c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid,
    '2025-05-15',
    'leadership meeting',
    'monigle',
    'ai training',
    1,
    350,
    350,
    '2025-04-15T02:13:18.021+00:00',
    '2025-04-15T02:13:18.252134+00:00'
  );

-- Verify the count of entries after insert
SELECT COUNT(*) FROM time_entries 
WHERE user_id = 'c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid;

-- View the data to confirm insertion
SELECT id, date, description, client, project, hours, rate, amount 
FROM time_entries 
WHERE user_id = 'c35bc00f-0c63-4cc5-a5d6-aafeff68d911'::uuid 
ORDER BY date DESC;
