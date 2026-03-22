-- Sender fields on orders (florist: sender != recipient)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sender_name varchar(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sender_email varchar(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sender_phone varchar(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_message text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_gift boolean DEFAULT false NOT NULL;

-- Notification template: support sending to sender vs recipient
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS recipient_type varchar(20) DEFAULT 'recipient' NOT NULL;
