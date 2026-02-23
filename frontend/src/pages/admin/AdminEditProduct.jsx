import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import API from '../../services/api';
import '../admin/AdminAddProduct.css';

/**
 * Admin Edit Product Page - with Dynamic Specifications
 */
const AdminEditProduct = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const categories = ['Wire & Cables', 'Fan', 'Pipes', 'Motors', 'Heater', 'Lights', 'Switches', 'Tank', 'Water Heater', 'Other'];

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: categories[0],
    brand: '',
    stock: '',
    specifications: {}
  });
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Same specification config as AdminAddProduct
  const specificationConfig = {
    'Fan': {
      icon: '🌀',
      required: [
        { key: 'bladeSize', label: 'Blade Size (inches)', type: 'number', placeholder: 'e.g., 48' },
        { key: 'sweep', label: 'Sweep (mm)', type: 'number', placeholder: 'e.g., 1200' },
        { key: 'speedRpm', label: 'Speed (RPM)', type: 'number', placeholder: 'e.g., 350' },
        { key: 'powerConsumption', label: 'Power Consumption (W)', type: 'number', placeholder: 'e.g., 75' },
        { key: 'mountType', label: 'Mount Type', type: 'select', options: ['Ceiling', 'Wall', 'Table', 'Pedestal', 'Exhaust'] }
      ],
      optional: [
        { key: 'warranty', label: 'Warranty', type: 'text', placeholder: 'e.g., 2 Years' }
      ]
    },
    'Motors': {
      icon: '⚙️',
      required: [
        { key: 'powerHp', label: 'Power (HP)', type: 'text', placeholder: 'e.g., 1 HP' },
        { key: 'voltage', label: 'Voltage', type: 'text', placeholder: 'e.g., 220V' },
        { key: 'phase', label: 'Phase', type: 'select', options: ['Single Phase', 'Three Phase'] },
        { key: 'rpm', label: 'RPM', type: 'number', placeholder: 'e.g., 1440' },
        { key: 'insulationClass', label: 'Insulation Class', type: 'select', options: ['Class A', 'Class B', 'Class F', 'Class H'] }
      ],
      optional: [
        { key: 'warranty', label: 'Warranty', type: 'text', placeholder: 'e.g., 1 Year' }
      ]
    },
    'Wire & Cables': {
      icon: '🔌',
      required: [
        { key: 'coreType', label: 'Core Type', type: 'select', options: ['Single Core', 'Multi Core', 'Flexible', 'Armoured'] },
        { key: 'wireGauge', label: 'Wire Gauge (sq mm)', type: 'text', placeholder: 'e.g., 1.5 sq mm' },
        { key: 'length', label: 'Length (meters)', type: 'number', placeholder: 'e.g., 100' },
        { key: 'conductorMaterial', label: 'Conductor Material', type: 'select', options: ['Copper', 'Aluminum', 'Copper Clad Aluminum'] },
        { key: 'insulationType', label: 'Insulation Type', type: 'select', options: ['PVC', 'XLPE', 'Rubber', 'FRLS'] }
      ],
      optional: [
        { key: 'voltageRating', label: 'Voltage Rating', type: 'text', placeholder: 'e.g., 1100V' },
        { key: 'isiCertified', label: 'ISI Certified', type: 'select', options: ['Yes', 'No'] }
      ]
    },
    'Heater': {
      icon: '🔥',
      required: [
        { key: 'powerWatt', label: 'Power (Watt)', type: 'number', placeholder: 'e.g., 2000' },
        { key: 'temperatureRange', label: 'Temperature Range', type: 'text', placeholder: 'e.g., 25-75°C' },
        { key: 'safetyFeatures', label: 'Safety Features', type: 'textarea', placeholder: 'e.g., Auto Cut-off, Thermostat, Pressure Relief Valve' }
      ],
      optional: [
        { key: 'warranty', label: 'Warranty', type: 'text', placeholder: 'e.g., 2 Years' },
        { key: 'capacityLiters', label: 'Capacity (Liters)', type: 'number', placeholder: 'e.g., 25' }
      ]
    },
    'Pipes': {
      icon: '🚰',
      required: [
        { key: 'diameter', label: 'Diameter (mm / inch)', type: 'text', placeholder: 'e.g., 25mm or 1 inch' },
        { key: 'length', label: 'Length (meters / feet)', type: 'text', placeholder: 'e.g., 3m or 10ft' },
        { key: 'material', label: 'Material', type: 'select', options: ['PVC', 'CPVC', 'UPVC', 'GI', 'PPR', 'HDPE'] },
        { key: 'pressureRating', label: 'Pressure Rating', type: 'select', options: ['Low Pressure', 'Medium Pressure', 'High Pressure', 'SDR 11', 'SDR 13.5'] }
      ],
      optional: [
        { key: 'usageType', label: 'Usage Type', type: 'select', options: ['Water Supply', 'Drainage', 'Sewage', 'Irrigation'] },
        { key: 'isiCertified', label: 'ISI Certified', type: 'select', options: ['Yes', 'No'] }
      ]
    },
    'Tank': {
      icon: '🛢️',
      required: [
        { key: 'capacityLiters', label: 'Capacity (Liters)', type: 'number', placeholder: 'e.g., 100' },
        { key: 'material', label: 'Material', type: 'select', options: ['Plastic', 'Steel', 'Fiber'] },
        { key: 'layers', label: 'Number of Layers', type: 'select', options: ['3', '4', '5'] },
        { key: 'height', label: 'Height', type: 'text', placeholder: 'e.g., 1.2m' },
        { key: 'diameter', label: 'Diameter', type: 'text', placeholder: 'e.g., 900mm' }
      ],
      optional: [
        { key: 'warranty', label: 'Warranty', type: 'text', placeholder: 'e.g., 5 Years' },
        { key: 'color', label: 'Color', type: 'text', placeholder: 'e.g., Black' }
      ]
    },
    'Switches': {
      icon: '💡',
      required: [
        { key: 'switchType', label: 'Switch Type', type: 'select', options: ['Modular', 'Non-Modular', 'Dimmer', 'Touch'] },
        { key: 'currentRating', label: 'Current Rating', type: 'select', options: ['6A', '10A', '16A', '20A'] },
        { key: 'voltage', label: 'Voltage', type: 'text', placeholder: 'e.g., 220-240V' },
        { key: 'color', label: 'Color', type: 'text', placeholder: 'e.g., White' }
      ],
      optional: [
        { key: 'warranty', label: 'Warranty', type: 'text', placeholder: 'e.g., 2 Years' },
        { key: 'plateIncluded', label: 'Plate Included', type: 'select', options: ['Yes', 'No'] }
      ]
    },
    'Lights': {
      icon: '💡',
      required: [
        { key: 'lightType', label: 'Light Type', type: 'select', options: ['LED', 'Tube Light', 'Bulb', 'Panel Light', 'Street Light'] },
        { key: 'wattage', label: 'Wattage (W)', type: 'number', placeholder: 'e.g., 12' },
        { key: 'colorTemperature', label: 'Color Temperature', type: 'select', options: ['Warm White (3000K)', 'Cool White (4000K)', 'Daylight (6500K)'] },
        { key: 'lumens', label: 'Lumens', type: 'number', placeholder: 'e.g., 800' }
      ],
      optional: [
        { key: 'warranty', label: 'Warranty', type: 'text', placeholder: 'e.g., 1 Year' },
        { key: 'voltage', label: 'Voltage', type: 'text', placeholder: 'e.g., 220V' }
      ]
    },
    'Water Heater': {
      icon: '🚿',
      required: [
        { key: 'capacityLiters', label: 'Capacity (Liters)', type: 'number', placeholder: 'e.g., 25' },
        { key: 'powerWatt', label: 'Power (Watt)', type: 'number', placeholder: 'e.g., 2000' },
        { key: 'voltage', label: 'Voltage', type: 'text', placeholder: 'e.g., 220V' },
        { key: 'heatingElementType', label: 'Heating Element Type', type: 'text', placeholder: 'e.g., Copper' },
        { key: 'innerTankMaterial', label: 'Inner Tank Material', type: 'text', placeholder: 'e.g., Stainless Steel' }
      ],
      optional: [
        { key: 'warranty', label: 'Warranty', type: 'text', placeholder: 'e.g., 2 Years' }
      ]
    },
    'Other': {
      icon: '📦',
      required: [],
      optional: [
        { key: 'specifications', label: 'Specifications', type: 'textarea', placeholder: 'Enter product specifications...' }
      ]
    }
  };

  const getCategoryKey = (category) => {
    const categoryMap = {
      'Fan': 'Fan',
      'Motor': 'Motors',
      'Motors': 'Motors',
      'Wire & Cables': 'Wire & Cables',
      'Heater': 'Heater',
      'Water Heater': 'Water Heater',
      'Pipe': 'Pipes',
      'Pipes': 'Pipes',
      'Tank': 'Tank',
      'Switch': 'Switches',
      'Switches': 'Switches',
      'Light': 'Lights',
      'Lights': 'Lights',
      'Other': 'Other'
    };

    return categoryMap[category] || category;
  };

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const { data } = await API.get(`/products/${id}`);
      const product = data.product;

      console.log('✅ Fetched product for editing:', {
        id: product._id,
        name: product.name,
        category: product.category,
        specificationsType: typeof product.specifications,
        specifications: product.specifications,
        specKeys: product.specifications ? Object.keys(product.specifications) : []
      });

      // Ensure specifications is always a proper object, never null/undefined
      const specs = product.specifications && typeof product.specifications === 'object' 
        ? product.specifications 
        : {};

      // Initialize form data with all product fields including specifications
      const initialFormData = {
        name: product.name || '',
        description: product.description || '',
        price: product.price || '',
        category: product.category || categories[0],
        brand: product.brand || '',
        stock: product.stock || '',
        specifications: specs // This will preserve ALL stored specs
      };

      console.log('✅ Initializing form with data:', {
        category: initialFormData.category,
        specificationCount: Object.keys(initialFormData.specifications).length,
        specifications: initialFormData.specifications
      });

      setFormData(initialFormData);
      setPreview(product.image || '');
      setError('');
    } catch (err) {
      console.error('❌ Error fetching product:', err);
      console.error('❌ Error response:', err.response?.data);
      setError(err.response?.data?.message || 'Failed to load product. Product not found.');
      setTimeout(() => navigate('/admin/products'), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'category') {
      // DON'T reset specifications - preserve any stored specs when category changes
      // This allows previously saved specs to remain if category is changed back
      setFormData(prev => ({
        ...prev,
        category: value
        // Keep specifications intact - specs will auto-map to the new category's fields
      }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSpecChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      specifications: {
        ...prev.specifications,
        [key]: value
      }
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('description', formData.description);
      data.append('price', formData.price);
      data.append('category', formData.category);
      data.append('brand', formData.brand);
      data.append('stock', formData.stock);

      if (image) {
        data.append('image', image);
      }

      // Specifications
      const specifications = Object.entries(formData.specifications).reduce((acc, [key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {});

      data.append('specifications', JSON.stringify(specifications));

      await API.put(`/products/${id}`, data, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      alert('Product updated successfully!');
      navigate('/admin/products');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to update product');
    } finally {
      setSubmitting(false);
    }
  };

  const activeCategoryKey = getCategoryKey(formData.category);
  const activeSpecConfig = specificationConfig[activeCategoryKey] || { required: [], optional: [] };

  const renderSpecField = (field, isRequired) => {
    // Get value from specifications, ensuring proper type handling
    const value = formData.specifications[field.key] !== undefined && formData.specifications[field.key] !== null
      ? String(formData.specifications[field.key])
      : '';
    
    const hasValue = value !== '';
    
    const commonProps = {
      name: field.key,
      value,
      onChange: (e) => handleSpecChange(field.key, e.target.value),
      required: isRequired,
      placeholder: field.placeholder,
      className: hasValue ? 'form-input has-value' : 'form-input'
    };

    if (field.type === 'select') {
      return (
        <select {...commonProps} className={hasValue ? 'form-select has-value' : 'form-select'}>
          <option value="">Select {field.label}</option>
          {field.options.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }

    if (field.type === 'textarea') {
      return (
        <textarea
          {...commonProps}
          rows={4}
          className={hasValue ? 'form-textarea has-value' : 'form-textarea'}
        />
      );
    }

    return (
      <input
        type={field.type || 'text'}
        {...commonProps}
      />
    );
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="admin-add-product-container">
          <div className="loading-state">
            <svg className="spinner" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <p>Loading product...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="admin-add-product-container">
        {/* Page Header */}
        <div className="page-header">
          <button onClick={() => navigate(-1)} className="back-button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Products
          </button>
          <h1 className="page-title">Edit Product</h1>
          <p className="page-subtitle">Update product details and specifications</p>
        </div>

        {/* Auto-Fill Info Banner */}
        <div className="alert-info">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
          <div>
            <strong>Auto-Fill Active:</strong> All previously saved data has been automatically loaded. 
            Fields with blue highlighting contain existing data. Change the category to see different specifications 
            while preserving any stored values.
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert-error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="product-form-modern">
          {/* Basic Information Card */}
          <div className="form-card">
            <div className="card-header">
              <h2 className="card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M9 3v18"/>
                </svg>
                Basic Information
              </h2>
              <p className="card-description">Essential product details and pricing</p>
            </div>
            <div className="card-body">
              {/* 2×3 Grid Layout - Perfect Alignment */}
              <div className="basic-info-grid">
                {/* Row 1: Product Name, Price, Stock Quantity */}
                <div className="input-group">
                  <label className="input-label">Product Name <span className="required">*</span></label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="e.g., Premium Ceiling Fan 48 inch"
                    className="form-input"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Price (₹) <span className="required">*</span></label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="form-input"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Stock Quantity <span className="required">*</span></label>
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleChange}
                    required
                    min="0"
                    placeholder="0"
                    className="form-input"
                  />
                </div>

                {/* Row 2: Category, Brand, Description */}
                <div className="input-group">
                  <label className="input-label">Category <span className="required">*</span></label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    required
                    className="form-select"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Brand <span className="required">*</span></label>
                  <input
                    type="text"
                    name="brand"
                    value={formData.brand}
                    onChange={handleChange}
                    required
                    placeholder="e.g., Havells, Crompton"
                    className="form-input"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Description <span className="required">*</span></label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    required
                    placeholder="Provide a detailed description..."
                    className="form-textarea grid-textarea"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Specifications Card */}
          <div className="form-card">
            <div className="card-header">
              <h2 className="card-title">
                <span className="category-icon">{activeSpecConfig.icon || '📋'}</span>
                {activeCategoryKey} Specifications
              </h2>
              <p className="card-description">Technical specifications for this category</p>
            </div>
            <div className="card-body">
              {activeSpecConfig.required.length === 0 && activeSpecConfig.optional.length === 0 ? (
                <div className="no-specs-message">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 12h6M9 16h6M9 8h6M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
                  </svg>
                  <p>No specifications available for this category</p>
                </div>
              ) : (
                <div className="specs-grid-layout">
                  {activeSpecConfig.required.length > 0 && (
                    <div className="spec-section required">
                      <div className="spec-section-header">
                        <span className="spec-badge required-badge">Required</span>
                        <span className="spec-count">{activeSpecConfig.required.length} fields</span>
                      </div>
                      <div className="spec-fields">
                        {activeSpecConfig.required.map(field => (
                          <div className="input-group" key={field.key}>
                            <label className="input-label">{field.label} <span className="required">*</span></label>
                            {renderSpecField(field, true)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeSpecConfig.optional.length > 0 && (
                    <div className="spec-section optional">
                      <div className="spec-section-header">
                        <span className="spec-badge optional-badge">Optional</span>
                        <span className="spec-count">{activeSpecConfig.optional.length} fields</span>
                      </div>
                      <div className="spec-fields">
                        {activeSpecConfig.optional.map(field => (
                          <div className="input-group" key={field.key}>
                            <label className="input-label">{field.label}</label>
                            {renderSpecField(field, false)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Product Image Card */}
          <div className="form-card">
            <div className="card-header">
              <h2 className="card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="m21 15-5-5L5 21"/>
                </svg>
                Product Image
              </h2>
              <p className="card-description">Update product image (optional)</p>
            </div>
            <div className="card-body">
              <div className="upload-area">
                <input
                  type="file"
                  id="product-image"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="upload-input"
                />
                <label htmlFor="product-image" className="upload-label">
                  {preview ? (
                    <div className="image-preview-box">
                      <img src={preview} alt="Preview" className="preview-image" />
                      <div className="preview-overlay">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                        </svg>
                        Click to change image
                      </div>
                    </div>
                  ) : (
                    <div className="upload-placeholder">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                      </svg>
                      <span className="upload-title">Click to upload or drag and drop</span>
                      <span className="upload-hint">Leave empty to keep existing image</span>
                      <span className="upload-hint">Recommended: 800×800px, max 5MB</span>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn-cancel"
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={submitting}>
              {submitting ? (
                <>
                  <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Updating Product...
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 13l4 4L19 7"/>
                  </svg>
                  Update Product
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};

export default AdminEditProduct;
