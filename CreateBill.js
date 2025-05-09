import React, { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';

const handleItemChange = useCallback((index, field, value) => {
  setFormData(prevData => {
    const newItems = [...prevData.items];
    const updatedItem = { ...newItems[index], [field]: value };
    
    // Recalculate sft and total whenever relevant fields change
    if (field === 'width' || field === 'height' || field === 'pricePerUnit' || field === 'quantity' || field === 'unit') {
      if (updatedItem.unit === 'Sft') {
        updatedItem.sft = updatedItem.width * updatedItem.height;
        updatedItem.total = updatedItem.sft * updatedItem.pricePerUnit * (updatedItem.quantity || 1);
      } else {
        updatedItem.total = updatedItem.pricePerUnit * (updatedItem.quantity || 1);
      }
    }
    
    newItems[index] = updatedItem;
    return { ...prevData, items: newItems };
  });
}, []);

const [formData, setFormData] = useState({
  billNumber: '',
  documentType: location.state?.documentType || 'Invoice',
  billDate: new Date().toISOString().split('T')[0],
  title: 'None',
  clientName: '',
  clientEmail: '',
  clientPhone: '',
  clientAddress: '',
  items: [{
    particular: '',
    description: generateDescription('HDHMR', '18mm', 'Hafele'),
    unit: 'Sft',
    quantity: 1,
    width: 0,
    height: 0,
    sft: 0,
    pricePerUnit: 1250,
    total: 0
  }],
  companyDetails: {
    name: 'JK INTERIOR\'S',
    address: '502, Spellbound towers,Sainikpuri,Secunderabad,Telangana 501301',
    phones: ['9063096060', '8099961514']
  },
  paymentTerms: [
    { stage: 'Confirmation advance with work order', percentage: 0, amount: 50000, note: 'Token' }
  ],
  termsAndConditions: [
    // ... existing terms and conditions ...
  ],
  discountType: 'amount',
  discountValue: 0
});

const handleAddItem = () => {
  setFormData(prevData => ({
    ...prevData,
    items: [...prevData.items, {
      particular: '',
      description: generateDescription('HDHMR', '18mm', 'Hafele'),
      unit: 'Sft',
      quantity: 1,
      width: 0,
      height: 0,
      sft: 0,
      pricePerUnit: 1250,
      total: 0
    }]
  }));
};

return (
  <button
    type="button"
    onClick={handleAddItem}
    className="flex items-center gap-1 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-[#B08968] text-white text-sm sm:text-base rounded-lg hover:bg-[#9C6644] transition-colors duration-300"
  >
    <Plus size={16} /> Add Item
  </button>
); 