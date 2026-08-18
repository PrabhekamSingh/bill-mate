/**
 * Database Schema Definitions
 * SQLite schema for the billing application
 */

export const SCHEMA_VERSION = 2;

export const SCHEMA_SQL = `
-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  opening_balance REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Items/Master data per customer (customer_id NULL = global catalog)
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'pcs',
  rate REAL DEFAULT 0,
  gst_rate REAL DEFAULT 0,
  category TEXT DEFAULT '',
  hsn_code TEXT DEFAULT '',
  stock_quantity REAL DEFAULT 0,
  min_stock REAL DEFAULT 5,
  location TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Global parts catalog (catalog_items) for car spare parts & inventory
CREATE TABLE IF NOT EXISTS catalog_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  unit TEXT DEFAULT 'pcs',
  rate REAL DEFAULT 0,
  gst_rate REAL DEFAULT 18,
  hsn_code TEXT DEFAULT '',
  description TEXT DEFAULT '',
  stock_quantity REAL DEFAULT 10,
  min_stock REAL DEFAULT 5,
  location TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bills/Invoices
CREATE TABLE IF NOT EXISTS bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  bill_number TEXT NOT NULL,
  bill_date DATE NOT NULL,
  subtotal REAL DEFAULT 0,
  gst_total REAL DEFAULT 0,
  total REAL DEFAULT 0,
  carry_forward REAL DEFAULT 0,
  paid REAL DEFAULT 0,
  balance REAL DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Bill line items
CREATE TABLE IF NOT EXISTS bill_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER NOT NULL,
  item_id INTEGER,
  catalog_item_id INTEGER,
  description TEXT NOT NULL,
  quantity REAL DEFAULT 1,
  unit TEXT DEFAULT 'pcs',
  rate REAL DEFAULT 0,
  gst_rate REAL DEFAULT 0,
  amount REAL DEFAULT 0,
  gst_amount REAL DEFAULT 0,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);

-- Payments received
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  bill_id INTEGER,
  amount REAL NOT NULL,
  payment_date DATE NOT NULL,
  mode TEXT DEFAULT 'cash',
  reference TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE SET NULL
);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_items_customer ON items(customer_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_category ON catalog_items(category);
CREATE INDEX IF NOT EXISTS idx_catalog_items_name ON catalog_items(name);
CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
`;

export const SEED_SQL = `
-- Insert initial schema version
INSERT OR REPLACE INTO schema_version (version) VALUES (${SCHEMA_VERSION});

-- Pre-seed Car Spare Parts Catalog
INSERT OR IGNORE INTO catalog_items (id, name, category, unit, rate, gst_rate, hsn_code, description) VALUES
  (1,  'Engine Oil (1L)',               'Engine & Lubrication', 'ltr',  350,  18, '27101990', 'Mineral/synthetic engine oil 1 litre'),
  (2,  'Engine Oil (5L)',               'Engine & Lubrication', 'can',  1500, 18, '27101990', 'Engine oil 5 litre can'),
  (3,  'Oil Filter',                    'Engine & Lubrication', 'pcs',  180,  18, '84212300', 'Engine oil filter'),
  (4,  'Air Filter',                    'Filters',              'pcs',  250,  18, '84213900', 'Engine air filter'),
  (5,  'Fuel Filter',                   'Filters',              'pcs',  320,  18, '84213100', 'Petrol/diesel fuel filter'),
  (6,  'Cabin Air Filter',              'Filters',              'pcs',  400,  18, '84213900', 'AC cabin / pollen filter'),
  (7,  'Brake Pad Set (Front)',          'Brakes',              'set',  900,  28, '68132000', 'Front disc brake pad set (4 pcs)'),
  (8,  'Brake Pad Set (Rear)',           'Brakes',              'set',  750,  28, '68132000', 'Rear disc brake pad set (4 pcs)'),
  (9,  'Brake Shoe Set',                'Brakes',              'set',  550,  28, '68132000', 'Drum brake shoe set (4 pcs)'),
  (10, 'Brake Disc (Front, each)',       'Brakes',              'pcs',  1200, 18, '87083000', 'Front brake rotor disc'),
  (11, 'Brake Fluid (DOT 3)',            'Brakes',              'ltr',  180,  18, '38199000', 'Brake / clutch fluid'),
  (12, 'Clutch Plate Kit',               'Clutch & Gearbox',   'set',  3500, 28, '16131000', 'Clutch disc + pressure plate + bearing'),
  (13, 'Clutch Cable',                   'Clutch & Gearbox',   'pcs',  350,  18, '85441100', 'Clutch cable for mechanical clutch'),
  (14, 'Gear Oil (1L)',                  'Clutch & Gearbox',   'ltr',  420,  18, '27101990', 'Gearbox / differential gear oil'),
  (15, 'Spark Plug',                     'Ignition',           'pcs',  150,  18, '85111000', 'Petrol engine spark plug'),
  (16, 'Spark Plug Set (4 pcs)',          'Ignition',           'set',  550,  18, '85111000', 'Set of 4 spark plugs'),
  (17, 'Ignition Coil',                  'Ignition',           'pcs',  1800, 18, '85113000', 'Ignition coil / distributor coil'),
  (18, 'Battery (35 Ah)',                'Electrical',         'pcs',  3200, 18, '85072000', 'Lead acid battery 35Ah'),
  (19, 'Battery (45 Ah)',                'Electrical',         'pcs',  4200, 18, '85072000', 'Lead acid battery 45Ah'),
  (20, 'Battery (65 Ah)',                'Electrical',         'pcs',  5800, 18, '85072000', 'Lead acid battery 65Ah'),
  (21, 'Alternator Belt',                'Belts & Hoses',      'pcs',  350,  18, '40103600', 'Alternator / fan V-belt'),
  (22, 'Timing Belt',                    'Belts & Hoses',      'pcs',  1200, 18, '40103200', 'Engine timing belt'),
  (23, 'Radiator Coolant (1L)',           'Cooling',            'ltr',  220,  18, '38200000', 'Antifreeze / coolant concentrate'),
  (24, 'Thermostat',                     'Cooling',            'pcs',  380,  18, '84833000', 'Engine thermostat & housing'),
  (25, 'Water Pump',                     'Cooling',            'pcs',  1600, 18, '84138200', 'Engine coolant water pump'),
  (26, 'Radiator Hose (Upper)',           'Cooling',            'pcs',  280,  18, '40094200', 'Upper radiator rubber hose'),
  (27, 'Radiator Hose (Lower)',           'Cooling',            'pcs',  240,  18, '40094200', 'Lower radiator rubber hose'),
  (28, 'Shock Absorber (Front)',          'Suspension',         'pcs',  2200, 18, '87084000', 'Front shock absorber strut'),
  (29, 'Shock Absorber (Rear)',           'Suspension',         'pcs',  1800, 18, '87084000', 'Rear shock absorber'),
  (30, 'Strut Mount',                    'Suspension',         'pcs',  650,  18, '87084000', 'Front strut mount / top bearing'),
  (31, 'Ball Joint (Lower)',             'Suspension',         'pcs',  550,  18, '87084000', 'Lower ball joint'),
  (32, 'Tie Rod End',                    'Steering',           'pcs',  480,  18, '87089900', 'Outer tie rod end / rack end'),
  (33, 'Tie Rod Inner',                  'Steering',           'pcs',  380,  18, '87089900', 'Inner tie rod / rack end'),
  (34, 'Steering Fluid',                 'Steering',           'ltr',  260,  18, '27101990', 'Power steering hydraulic fluid'),
  (35, 'Control Arm Bushing',            'Suspension',         'set',  320,  18, '40169300', 'Control arm rubber bushing set'),
  (36, 'Wheel Bearing (Front)',          'Wheels & Tyres',     'pcs',  850,  18, '84821000', 'Front wheel hub bearing'),
  (37, 'Wheel Bearing (Rear)',           'Wheels & Tyres',     'pcs',  750,  18, '84821000', 'Rear wheel hub bearing'),
  (38, 'Tyre (165/65 R14)',              'Wheels & Tyres',     'pcs',  3200, 28, '40111000', 'Tyre 165/65 R14'),
  (39, 'Tyre (185/65 R15)',              'Wheels & Tyres',     'pcs',  4200, 28, '40111000', 'Tyre 185/65 R15'),
  (40, 'Tyre (195/55 R16)',              'Wheels & Tyres',     'pcs',  5500, 28, '40111000', 'Tyre 195/55 R16'),
  (41, 'Wiper Blade (Front pair)',        'Body & Accessories', 'pair', 380,  18, '85122000', 'Front windscreen wiper blade set'),
  (42, 'Wiper Blade (Rear)',             'Body & Accessories', 'pcs',  220,  18, '85122000', 'Rear wiper blade'),
  (43, 'Headlight Bulb H4',             'Electrical',         'pcs',  120,  18, '85392100', 'Halogen headlight bulb H4'),
  (44, 'Tail Light Bulb',               'Electrical',         'pcs',  45,   18, '85392900', 'Rear stop/tail light bulb'),
  (45, 'Fuse Set',                       'Electrical',         'set',  80,   18, '85369000', 'Assorted automotive fuse set'),
  (46, 'AC Filter / Drier',             'AC System',          'pcs',  650,  18, '84212300', 'AC refrigerant drier / receiver'),
  (47, 'AC Compressor Oil',             'AC System',          'ltr',  480,  18, '27101990', 'AC compressor lubricant oil'),
  (48, 'Power Steering Rack',           'Steering',           'pcs',  7500, 18, '87087000', 'Hydraulic steering rack assembly'),
  (49, 'Exhaust Silencer',              'Exhaust',            'pcs',  2800, 18, '87087000', 'Exhaust muffler / silencer'),
  (50, 'Catalytic Converter',           'Exhaust',            'pcs',  6500, 18, '85435000', 'Exhaust catalytic converter'),
  (51, 'Lambda / O2 Sensor',            'Sensors',            'pcs',  1200, 18, '90272000', 'Oxygen / lambda sensor'),
  (52, 'MAF Sensor',                    'Sensors',            'pcs',  2200, 18, '90262000', 'Mass air flow sensor'),
  (53, 'Crankshaft Position Sensor',    'Sensors',            'pcs',  980,  18, '90262000', 'CKP crankshaft sensor'),
  (54, 'Wheel Speed Sensor (ABS)',      'Sensors',            'pcs',  850,  18, '90262000', 'ABS wheel speed sensor'),
  (55, 'Labour Charges',               'Labour',              'job',  500,  18, '99851800', 'Mechanical service labour charges'),
  (56, 'Full Service Charges',          'Labour',              'job',  1500, 18, '99851800', 'Full vehicle service labour'),
  (57, 'AC Service Charges',            'Labour',              'job',  800,  18, '99851800', 'AC regas and service charges'),
  (58, 'Wheel Alignment Charges',       'Labour',              'job',  400,  18, '99851800', 'Four-wheel alignment'),
  (59, 'Wheel Balancing Charges',       'Labour',              'job',  300,  18, '99851800', 'All four wheels balancing');
`;