import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import ProductReviews from '../../components/ProductReviews';
import { CartContext } from '../../context/CartContext';
import { AuthContext } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import API from '../../services/api';
import './ProductDetails.css';

/**
 * Product Details Page Component
 * Detailed view of a single product
 */
const ProductDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useContext(CartContext);
  const { isAuthenticated } = useContext(AuthContext);
  const { success, error, info } = useToast();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const { data } = await API.get(`/products/${id}`);
      setProduct(data.product);
    } catch (err) {
      console.error('Error fetching product:', err);
      error('Product not found');
      navigate('/products');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      info('Please login to add items to cart');
      navigate('/login');
      return;
    }

    const result = await addToCart(product._id, quantity);
    if (result.success) {
      success(`Added ${quantity} item(s) to cart! 🛒`);
      setQuantity(1); // Reset quantity after successful add
    } else {
      error(result.message);
    }
  };

  const handleBuyNow = async () => {
    if (!isAuthenticated) {
      info('Please login to purchase');
      navigate('/login');
      return;
    }

    await handleAddToCart();
    navigate('/cart');
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="spinner"></div>
      </>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <>
      <Navbar />

      <div className="product-details-page">
        <div className="container">
          <button onClick={() => navigate(-1)} className="back-btn">
            ← Back
          </button>

          <div className="product-details-grid">
            {/* Product Image */}
            <div className="product-image-section">
              <div className="product-image-card">
                <img 
                  src={product.image} 
                  alt={product.name}
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/400x400?text=Product';
                  }}
                />
              </div>
              {product.stock === 0 && (
                <div className="out-of-stock-overlay">Out of Stock</div>
              )}
            </div>

            {/* Product Info */}
            <div className="product-info-section">
              <span className="product-category">{product.category}</span>
              <h1>{product.name}</h1>
              <p className="product-brand">Brand: {product.brand}</p>

              <div className="product-rating">
                <span className="rating-stars">★★★★★</span>
                <span className="rating-value">{product.ratings.average.toFixed(1)}</span>
                <span className="rating-count">({product.ratings.count} reviews)</span>
              </div>

              <div className="product-price-section">
                <div className="price">
                  {product.priceType === 'range' ? (
                    <>₹{product.priceMin?.toLocaleString()} - ₹{product.priceMax?.toLocaleString()}</>
                  ) : (
                    <>₹{product.price?.toLocaleString()}</>
                  )}
                </div>
                <div className="stock-status">
                  {product.stock > 0 ? (
                    <span className="in-stock">In Stock: {product.stock} units</span>
                  ) : (
                    <span className="out-of-stock-text">Out of Stock</span>
                  )}
                </div>
              </div>

              <div className="product-description">
                <h3>Description</h3>
                <p>{product.description}</p>
              </div>

              {product.specifications && (
                <div className="product-specifications">
                  <h3>Specifications</h3>
                  <table>
                    <tbody>
                      {product.specifications.power && (
                        <tr>
                          <td>Power</td>
                          <td>{product.specifications.power}</td>
                        </tr>
                      )}
                      {product.specifications.voltage && (
                        <tr>
                          <td>Voltage</td>
                          <td>{product.specifications.voltage}</td>
                        </tr>
                      )}
                      {product.specifications.warranty && (
                        <tr>
                          <td>Warranty</td>
                          <td>{product.specifications.warranty}</td>
                        </tr>
                      )}
                      {product.specifications.color && (
                        <tr>
                          <td>Color</td>
                          <td>{product.specifications.color}</td>
                        </tr>
                      )}
                      {product.specifications.dimensions && (
                        <tr>
                          <td>Dimensions</td>
                          <td>{product.specifications.dimensions}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {product.stock > 0 && (
                <div className="product-actions">
                  <div className="quantity-selector">
                    <label>Quantity:</label>
                    <div className="quantity-controls">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      >
                        -
                      </button>
                      <span>{quantity}</span>
                      <button
                        onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="action-buttons">
                    <button onClick={handleAddToCart} className="btn add-to-cart-btn">
                      <svg className="btn-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                      </svg>
                      Add to Cart
                    </button>
                    <button onClick={handleBuyNow} className="btn buy-now-btn">
                      <svg className="btn-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/>
                      </svg>
                      Buy Now
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {product.stock > 0 && (
        <div className="mobile-action-bar">
          <button onClick={handleAddToCart} className="btn add-to-cart-btn">
            <svg className="btn-icon" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
            </svg>
            Add to Cart
          </button>
          <button onClick={handleBuyNow} className="btn buy-now-btn">
            <svg className="btn-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/>
            </svg>
            Buy Now
          </button>
        </div>
      )}

      {/* Product Reviews Section */}
      <div className="container">
        <ProductReviews productId={product._id} />
      </div>

      <Footer />
    </>
  );
};

export default ProductDetails;
