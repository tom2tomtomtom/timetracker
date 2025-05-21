-- Create the time_entries table
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  client TEXT,
  project TEXT,
  hours NUMERIC(5,2) NOT NULL,
  rate NUMERIC(10,2) NOT NULL,
  days NUMERIC(5,2),
  day_rate NUMERIC(10,2),
  amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on user_id and date for faster queries
CREATE INDEX time_entries_user_id_date_idx ON time_entries (user_id, date);

-- Create RLS policies for time_entries
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own time entries" ON time_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own time entries" ON time_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time entries" ON time_entries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own time entries" ON time_entries
  FOR DELETE USING (auth.uid() = user_id);

-- Create the expenses table
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  client TEXT,
  project TEXT,
  receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on user_id and date for faster queries
CREATE INDEX expenses_user_id_date_idx ON expenses (user_id, date);

-- Create RLS policies for expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own expenses" ON expenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own expenses" ON expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses" ON expenses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expenses" ON expenses
  FOR DELETE USING (auth.uid() = user_id);

-- Create the settings table
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_rate NUMERIC(10,2) DEFAULT 350,
  default_payment_terms TEXT DEFAULT 'Net 30',
  name TEXT,
  email TEXT,
  address TEXT,
  payment_instructions TEXT,
  theme TEXT DEFAULT 'light',
  date_format TEXT DEFAULT 'MM/DD/YYYY',
  currency TEXT DEFAULT 'USD',
  form_data JSONB DEFAULT NULL, -- For storing auto-save form data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Create RLS policies for settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings" ON settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" ON settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Create the rates table
CREATE TABLE rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create RLS policies for rates
ALTER TABLE rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rates" ON rates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rates" ON rates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rates" ON rates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rates" ON rates
  FOR DELETE USING (auth.uid() = user_id);

-- Create the invoices table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  client TEXT NOT NULL,
  project TEXT,
  invoice_date DATE NOT NULL,
  payment_terms TEXT,
  notes TEXT,
  total_hours NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  expenses_amount NUMERIC(10,2) DEFAULT 0,
  grand_total NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'unpaid',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create RLS policies for invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own invoices" ON invoices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own invoices" ON invoices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own invoices" ON invoices
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own invoices" ON invoices
  FOR DELETE USING (auth.uid() = user_id);

-- Create the invoice_items table
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  hours NUMERIC(5,2),
  rate NUMERIC(10,2),
  amount NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL, -- 'time' or 'expense'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create RLS policies for invoice_items
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own invoice items" ON invoice_items
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM invoices WHERE id = invoice_items.invoice_id
    )
  );

CREATE POLICY "Users can insert their own invoice items" ON invoice_items
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM invoices WHERE id = invoice_items.invoice_id
    )
  );

CREATE POLICY "Users can update their own invoice items" ON invoice_items
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM invoices WHERE id = invoice_items.invoice_id
    )
  );

CREATE POLICY "Users can delete their own invoice items" ON invoice_items
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM invoices WHERE id = invoice_items.invoice_id
    )
  );

-- Create the recurring_entries table
CREATE TABLE recurring_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  client TEXT,
  project TEXT,
  hours NUMERIC(5,2) NOT NULL,
  rate NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create RLS policies for recurring_entries
ALTER TABLE recurring_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recurring entries" ON recurring_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recurring entries" ON recurring_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring entries" ON recurring_entries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring entries" ON recurring_entries
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_time_entries_updated_at
BEFORE UPDATE ON time_entries
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
BEFORE UPDATE ON settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rates_updated_at
BEFORE UPDATE ON rates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoice_items_updated_at
BEFORE UPDATE ON invoice_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_entries_updated_at
BEFORE UPDATE ON recurring_entries
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();