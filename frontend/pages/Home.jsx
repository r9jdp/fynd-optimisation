import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import "./style/home.css";
import DEFAULT_NO_IMAGE from "../public/assets/default_icon_listing.png";
import loaderGif from "../public/assets/loader.gif";
import axios from "axios";
import urlJoin from "url-join";
import image from "./style/image.png"
import iphone from "./style/iPhone-16-Pro-Max-Latest-Apple-Smartphone.png"
// import { createClient } from "@boltic/sdk";

const EXAMPLE_MAIN_URL = window.location.origin;

export const Home = () => {
  const [pageLoading, setPageLoading] = useState(false);
  const [productList, setProductList] = useState([]);
  const [pricingStatus, setPricingStatus] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [showPendingRequests, setShowPendingRequests] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrice, setEditedPrice] = useState('');
  const { application_id, company_id } = useParams();
  const navigate = useNavigate();

  const goToPromotions = () => {
    const basePath = application_id 
      ? `/company/${company_id}/application/${application_id}/promotions`
      : `/company/${company_id}/promotions`;
    navigate(basePath);
  };
  
  useEffect(() => {
    isApplicationLaunch() ? fetchApplicationProducts() : fetchProducts();
    fetchPricingStatus();
  }, [application_id]);

  const fetchPricingStatus = async () => {
    try {
      const { data } = await axios.get(urlJoin(EXAMPLE_MAIN_URL, '/api/products/pricing-status'), {
        headers: {
          "x-company-id": company_id,
        }
      });
      console.log("Pricing Status Data:", data.all);
      if (data.all && data.all.status === 'PENDING') {
        setPricingStatus(data.all);
      }
    } catch (e) {
      console.error("Error fetching pricing status:", e);
    }
  };

  const fetchProducts = async () => {
    setPageLoading(true);
    try {
      const { data } = await axios.get(urlJoin(EXAMPLE_MAIN_URL, '/api/products'), {
        headers: {
          "x-company-id": company_id,
        }
      });
      setProductList(data.items);
    } catch (e) {
      console.error("Error fetching products:", e);
    } finally {
      setPageLoading(false);
    }
  };

  const fetchApplicationProducts = async () => {
    setPageLoading(true);
    try {
      const { data } = await axios.get(urlJoin(EXAMPLE_MAIN_URL, `/api/products/application/${application_id}`), {
        headers: {
          "x-company-id": company_id,
        }
      })
      setProductList(data.items);
    } catch (e) {
      console.error("Error fetching application products:", e);
    } finally {
      setPageLoading(false);
    }
  };


  const productProfileImage = (media) => {
    if (!media || !media.length) {
      return DEFAULT_NO_IMAGE;
    }
    const profileImg = media.find(m => m.type === "image");
    return profileImg?.url || DEFAULT_NO_IMAGE;
  };

  const isApplicationLaunch = () => !!application_id;

  const handleAccept = () => {
    console.log("Accepted the suggested price update.");
    // Call the backend proxy route instead of the external API directly to avoid CORS issues
    const API_URL = urlJoin(EXAMPLE_MAIN_URL, '/api/products/accept-price-update');
    const requestData = {};
    const headers = {
      "Content-Type": "application/json",
      "x-company-id": company_id, // Pass company_id if needed by middleware, though not strictly used in the proxy route
    };

    axios.post(API_URL, requestData, { headers })
      .then(response => {
        console.log("Request was successful.");
        console.log("Response:", response.data);
        setShowPopup(false);
        window.location.reload();
      })
      .catch(error => {
        console.error("Request failed:", error);
        setShowPopup(false);
      });
  };

  const handleDeny = () => {
    console.log("Denied the suggested price update.");
    const API_URL = urlJoin(EXAMPLE_MAIN_URL, '/api/products/deny-price-update');
    
    // Pass the pricingStatus object so the backend can use the ID if available
    const requestData = pricingStatus || {}; 
    const headers = {
      "Content-Type": "application/json",
      "x-company-id": company_id,
    };

    axios.post(API_URL, requestData, { headers })
      .then(response => {
        console.log("Deny request successful.");
        setShowPopup(false);
        window.location.reload();
      })
      .catch(error => {
        console.error("Deny request failed:", error);
        setShowPopup(false);
      });
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setEditedPrice(pricingStatus.suggested_price);
  };

  const handleEditSubmit = () => {
    console.log("Submitting edited price:", editedPrice);
    const API_URL = urlJoin(EXAMPLE_MAIN_URL, '/api/products/edit-price-update');
    
    const requestData = {
      new_price: editedPrice,
      id: pricingStatus.id
    };
    
    const headers = {
      "Content-Type": "application/json",
      "x-company-id": company_id,
    };

    axios.post(API_URL, requestData, { headers })
      .then(response => {
        console.log("Edit and Accept request successful.");
        setShowPopup(false);
        setIsEditing(false);
        window.location.reload();
      })
      .catch(error => {
        console.error("Edit request failed:", error);
        // Optionally keep popup open to show error
      });
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <header className="top-bar">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">N</span> Nova Seller Panel
          </div>
          <div className="search-bar">
            <input type="text" placeholder="Search inventory..." />
            <button className="search-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </button>
          </div>
          <div className="user-actions">
            <button className="promotions-nav-btn" onClick={goToPromotions}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              AI Promotions
            </button>
            <div className="user-profile">
              <span>Rajdeep Pandey</span>
              <div className="avatar">
                <img src={image} alt="User" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="dashboard-container">
        <div className="main-content">
          <div className="page-header">
            <h1>Product Inventory</h1>
            <p>Manage your products and view details.</p>
          </div>

          {/* Pending Requests Toggle Section */}
          <div className="pending-toggle-section">
            <div className="toggle-header" onClick={() => setShowPendingRequests(!showPendingRequests)}>
              <div className="toggle-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <h2>Pending Price Requests</h2>
                {pricingStatus && pricingStatus.status === 'PENDING' && (
                  <span className="pending-badge">1</span>
                )}
              </div>
              <svg 
                className={`toggle-arrow ${showPendingRequests ? 'open' : ''}`} 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
            
            {showPendingRequests && pricingStatus && pricingStatus.status === 'PENDING' && (
              <div className="pending-requests-content">
                <div className="pending-product-card">
                  <div className="pending-product-image">
                    <img src={iphone} alt="iPhone 16 Pro Max" />
                  </div>
                  <div className="pending-product-info">
                    <h4>iPhone 16 Pro Max</h4>
                    <p className="pending-product-desc">256GB - Natural Titanium</p>
                    <div className="pending-price-info">
                      <span className="current-price-label">Current: </span>
                      <span className="current-price-value">₹{pricingStatus.current_price ? Number(pricingStatus.current_price).toLocaleString('en-IN') : '1,45,000'}</span>
                      <span className="price-arrow">→</span>
                      <span className="suggested-price-label">Suggested: </span>
                      <span className="suggested-price-value">₹{pricingStatus.suggested_price ? Number(pricingStatus.suggested_price).toLocaleString('en-IN') : '1,34,890'}</span>
                    </div>
                  </div>
                  <button className="edit-icon-btn" onClick={() => setShowPopup(true)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                </div>
              </div>
            )}
            
            {showPendingRequests && (!pricingStatus || pricingStatus.status !== 'PENDING') && (
              <div className="pending-requests-content">
                <p className="no-pending">No pending price requests at the moment.</p>
              </div>
            )}
          </div>

          {pageLoading ? (
            <div className="loader-container" data-testid="loader">
              <img src={loaderGif} alt="loader GIF" />
            </div>
          ) : (
            <div className="table-container">
              <table className="product-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Brand</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {productList.length > 0 ? productList.map((product, index) => (
                    <tr key={product.uid || index}>
                      <td>
                        <div className="product-cell">
                          <img src={productProfileImage(product.media)} alt={product.name} className="product-thumb" />
                          <div className="product-name-wrapper">
                            <span className="product-name">{product.name}</span>
                            <span className="product-slug">{product.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td>{product.brand?.name || '-'}</td>
                      <td>{product.category_slug || '-'}</td>
                      <td>
                        <span className="price-tag">
                          {product.price?.effective?.currency_symbol} {product.price?.effective?.max?.toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td>
                        {pricingStatus && product.name.toLowerCase().includes('iphone 16 pro max') ? (
                           <button className="status-badge pending-btn" onClick={() => setShowPopup(true)}>
                             Review Pending
                           </button>
                        ) : (
                           <span className="status-badge active">Active</span>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="5" className="no-data">No products found in your inventory.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {showPopup && pricingStatus && (
        <div className="popup-overlay">
          <div className="popup-content">
            <h3>{isEditing ? "Edit Suggested Price" : "Price Update Suggestion"}</h3>
            
            {!isEditing ? (
              <>
                <p>A new optimized price is suggested for <strong>iPhone 16 Pro Max</strong>.</p>
                <div className="price-comparison">
                  <div className="old-price">
                    <span>Current Price</span>
                    <strong>₹{pricingStatus.current_price ? Number(pricingStatus.current_price).toLocaleString('en-IN') : '1,34,890'}</strong>
                  </div>
                  <div className="arrow">→</div>
                  <div className="new-price">
                    <span>Suggested Price</span>
                    <strong>₹{pricingStatus.suggested_price ? Number(pricingStatus.suggested_price).toLocaleString('en-IN') : '1,29,999'}</strong>
                  </div>
                </div>
                <div className="popup-actions">
                  <button className="btn-accept" onClick={handleAccept}>Accept</button>
                  <button className="btn-deny" onClick={handleDeny}>Deny</button>
                  <button className="btn-edit" onClick={handleEditClick}>Edit</button>
                </div>
              </>
            ) : (
              <div className="edit-price-section">
                <p>Enter the new price for <strong>iPhone 16 Pro Max</strong>:</p>
                <div className="input-group" style={{ margin: '20px 0' }}>
                  <input 
                    type="number" 
                    value={editedPrice} 
                    onChange={(e) => setEditedPrice(e.target.value)}
                    className="price-input"
                    style={{ 
                      padding: '10px', 
                      width: '100%', 
                      fontSize: '16px', 
                      border: '1px solid #ddd', 
                      borderRadius: '4px' 
                    }}
                    placeholder="Enter new price"
                  />
                </div>
                <div className="popup-actions">
                  <button className="btn-accept" onClick={handleEditSubmit}>Save & Accept</button>
                  <button className="btn-deny" onClick={() => setIsEditing(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
