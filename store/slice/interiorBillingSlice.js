export const createBill = createAsyncThunk(
  'interiorBilling/createBill',
  async (billData, { rejectWithValue }) => {
    try {
      // Process items to ensure quantity and totals are correct
      const processedItems = billData.items.map(item => ({
        ...item,
        quantity: item.quantity || 1,
        total: item.unit === 'Sft' 
          ? (item.width * item.height * item.pricePerUnit * (item.quantity || 1))
          : (item.pricePerUnit * (item.quantity || 1))
      }));

      // Calculate grand total
      const grandTotal = processedItems.reduce((sum, item) => sum + item.total, 0);

      // Ensure documentType is set, default to 'Invoice' if not provided
      const billDataWithType = {
        ...billData,
        items: processedItems,
        grandTotal,
        documentType: billData.documentType || 'Invoice',
        date: new Date(billData.billDate).toISOString(),
        // Add discount amount calculation
        discount: billData.discountType === 'percentage' 
          ? (billData.discountValue * grandTotal) / 100 
          : billData.discountValue || 0,
        finalAmount: billData.discountType === 'percentage'
          ? grandTotal - ((billData.discountValue * grandTotal) / 100)
          : grandTotal - (billData.discountValue || 0)
      };
      
      const response = await API.post('/api/interior/bills', billDataWithType, {
        headers: getAuthHeader()
      });
      if (!response.data || !response.data._id) {
        throw new Error('Invalid response from server');
      }

      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Unauthorized access');
      }
      console.error('Create bill error:', error);
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to create bill');
    }
  }
);

export const updateBill = createAsyncThunk(
  'interiorBilling/updateBill',
  async ({ id, billData }, { rejectWithValue }) => {
    try {
      // Process items to ensure quantity and totals are correct
      const processedItems = billData.items.map(item => ({
        ...item,
        quantity: item.quantity || 1,
        total: item.unit === 'Sft' 
          ? (item.width * item.height * item.pricePerUnit * (item.quantity || 1))
          : (item.pricePerUnit * (item.quantity || 1))
      }));

      // Calculate grand total
      const grandTotal = processedItems.reduce((sum, item) => sum + item.total, 0);

      // Transform data for backend compatibility
      const transformedData = {
        ...billData,
        items: processedItems,
        grandTotal,
        clientName: billData.clientName,
        documentType: billData.documentType || 'Invoice',
        date: new Date(billData.billDate).toISOString(),
        // Add discount amount calculation
        discount: billData.discountType === 'percentage' 
          ? (billData.discountValue * grandTotal) / 100 
          : billData.discountValue || 0,
        finalAmount: billData.discountType === 'percentage'
          ? grandTotal - ((billData.discountValue * grandTotal) / 100)
          : grandTotal - (billData.discountValue || 0)
      };
      delete transformedData.customerName; // Remove the old field
      
      const response = await API.put(`/api/interior/bills/${id}`, transformedData, {
        headers: getAuthHeader()
      });
      return response.data.data;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Unauthorized access');
      }
      return rejectWithValue(error.response.data);
    }
  }
); 