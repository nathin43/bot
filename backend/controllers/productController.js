const Product = require('../models/Product');
const path = require('path');

// Mock data for fallback when database is unavailable
const MOCK_PRODUCTS = [
  {
    _id: '1',
    name: 'Wireless Headphones',
    description: 'High-quality wireless headphones with noise cancellation',
    price: 99.99,
    category: 'Audio',
    brand: 'TechBrand',
    stock: 50,
    image: '/uploads/products/headphones.jpg',
    featured: true,
    status: 'active'
  },
  {
    _id: '2',
    name: 'USB-C Cable',
    description: 'Fast charging USB-C cable',
    price: 12.99,
    category: 'Cables',
    brand: 'TechBrand',
    stock: 100,
    image: '/uploads/products/usb-cable.jpg',
    featured: true,
    status: 'active'
  },
  {
    _id: '3',
    name: 'Screen Protector',
    description: 'Tempered glass screen protector',
    price: 9.99,
    category: 'Accessories',
    brand: 'ScreenGuard',
    stock: 150,
    image: '/uploads/products/protector.jpg',
    featured: true,
    status: 'active'
  },
  {
    _id: '4',
    name: 'Phone Case',
    description: 'Durable protective phone case',
    price: 19.99,
    category: 'Accessories',
    brand: 'CaseWorks',
    stock: 75,
    image: '/uploads/products/case.jpg',
    featured: false,
    status: 'active'
  }
];

/**
 * Get all products with filtering, sorting, and pagination
 * @route GET /api/products
 * @access Public
 */
exports.getProducts = async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, sort, page = 1, limit = 12 } = req.query;

    // Try to fetch from database
    try {
      // Build query
      let query = {};

      // Category filter
      if (category && category !== 'all') {
        query.category = category;
      }

      // Search filter
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { brand: { $regex: search, $options: 'i' } }
        ];
      }

      // Price filter
      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = Number(minPrice);
        if (maxPrice) query.price.$lte = Number(maxPrice);
      }

      // Sorting
      let sortOption = {};
      if (sort === 'price-asc') {
        sortOption.price = 1;
      } else if (sort === 'price-desc') {
        sortOption.price = -1;
      } else if (sort === 'name') {
        sortOption.name = 1;
      } else {
        sortOption.createdAt = -1; // Default: newest first
      }

      // Pagination
      const skip = (page - 1) * limit;

      // Execute query
      const products = await Product.find(query)
        .sort(sortOption)
        .limit(Number(limit))
        .skip(skip);

      // Get total count for pagination
      const total = await Product.countDocuments(query);

      return res.status(200).json({
        success: true,
        count: products.length,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: Number(page),
        products,
        source: 'database'
      });
    } catch (dbError) {
      console.warn('Database query failed, using mock data:', dbError.message);
      
      // Fallback to mock data
      let filteredProducts = [...MOCK_PRODUCTS];

      // Category filter
      if (category && category !== 'all') {
        filteredProducts = filteredProducts.filter(p => p.category.toLowerCase() === category.toLowerCase());
      }

      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        filteredProducts = filteredProducts.filter(p =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower) ||
          p.brand.toLowerCase().includes(searchLower)
        );
      }

      // Price filter
      if (minPrice || maxPrice) {
        filteredProducts = filteredProducts.filter(p => {
          if (minPrice && p.price < Number(minPrice)) return false;
          if (maxPrice && p.price > Number(maxPrice)) return false;
          return true;
        });
      }

      // Sorting
      if (sort === 'price-asc') {
        filteredProducts.sort((a, b) => a.price - b.price);
      } else if (sort === 'price-desc') {
        filteredProducts.sort((a, b) => b.price - a.price);
      } else if (sort === 'name') {
        filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
      }

      // Pagination
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const skip = (pageNum - 1) * limitNum;
      const paginatedProducts = filteredProducts.slice(skip, skip + limitNum);
      const total = filteredProducts.length;

      return res.status(200).json({
        success: true,
        count: paginatedProducts.length,
        total,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        products: paginatedProducts,
        source: 'mock-data',
        message: 'Database unavailable - showing sample products'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get single product by ID
 * @route GET /api/products/:id
 * @access Public
 */
exports.getProduct = async (req, res) => {
  try {
    // Try database first
    try {
      const product = await Product.findById(req.params.id);
      if (product) {
        return res.status(200).json({
          success: true,
          product,
          source: 'database'
        });
      }
    } catch (dbError) {
      console.warn('Database query failed, checking mock data:', dbError.message);
    }

    // Fallback to mock data
    const product = MOCK_PRODUCTS.find(p => p._id === req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      product,
      source: 'mock-data'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get featured products
 * @route GET /api/products/featured
 * @access Public
 */
exports.getFeaturedProducts = async (req, res) => {
  try {
    // Try database first
    try {
      const products = await Product.find({ featured: true, status: 'active' })
        .limit(8)
        .sort('-createdAt');
      
      if (products && products.length > 0) {
        return res.status(200).json({
          success: true,
          count: products.length,
          products,
          source: 'database'
        });
      }
    } catch (dbError) {
      console.warn('Database query failed, using mock data:', dbError.message);
    }

    // Fallback to mock data
    const products = MOCK_PRODUCTS.filter(p => p.featured && p.status === 'active');
    
    res.status(200).json({
      success: true,
      count: products.length,
      products,
      source: 'mock-data',
      message: 'Database unavailable - showing sample featured products'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get all categories
 * @route GET /api/products/categories/all
 * @access Public
 */
exports.getCategories = async (req, res) => {
  try {
    // Try database first
    try {
      const categories = await Product.distinct('category');
      if (categories && categories.length > 0) {
        return res.status(200).json({
          success: true,
          categories,
          source: 'database'
        });
      }
    } catch (dbError) {
      console.warn('Database query failed, using mock data:', dbError.message);
    }

    // Fallback to mock data
    const categories = [...new Set(MOCK_PRODUCTS.map(p => p.category))];
    
    res.status(200).json({
      success: true,
      categories,
      source: 'mock-data',
      message: 'Database unavailable - showing sample categories'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create new product (Admin only)
 * @route POST /api/products
 * @access Private/Admin
 */
exports.createProduct = async (req, res) => {
  try {
    // Get image path if uploaded
    let imagePath = '';
    if (req.file) {
      imagePath = `/uploads/products/${req.file.filename}`;
    }

    // Parse specifications if it's a JSON string
    if (req.body.specifications && typeof req.body.specifications === 'string') {
      try {
        req.body.specifications = JSON.parse(req.body.specifications);
      } catch (e) {
        console.error('Failed to parse specifications:', e);
        req.body.specifications = {};
      }
    }

    const productData = {
      ...req.body,
      image: imagePath || req.body.image
    };

    const product = await Product.create(productData);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update product (Admin only)
 * @route PUT /api/products/:id
 * @access Private/Admin
 */
exports.updateProduct = async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Get image path if uploaded
    if (req.file) {
      req.body.image = `/uploads/products/${req.file.filename}`;
    }

    // Parse specifications if it's a JSON string
    if (req.body.specifications && typeof req.body.specifications === 'string') {
      try {
        req.body.specifications = JSON.parse(req.body.specifications);
      } catch (e) {
        console.error('Failed to parse specifications:', e);
        req.body.specifications = {};
      }
    }

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Delete product (Admin only)
 * @route DELETE /api/products/:id
 * @access Private/Admin
 */
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await product.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Toggle product status (Admin only)
 * @route PATCH /api/products/:id/status
 * @access Private/Admin
 */
exports.toggleProductStatus = async (req, res) => {
  try {
    const { status } = req.body;

    // Validate status value
    if (!status || !['active', 'inactive', 'out-of-stock'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be: active, inactive, or out-of-stock'
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Update only the status field
    product.status = status;
    await product.save();

    res.status(200).json({
      success: true,
      message: `Product status updated to ${status}`,
      product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
