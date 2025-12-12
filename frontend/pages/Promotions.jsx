import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import urlJoin from "url-join";
import "./style/promotions.css";

const EXAMPLE_MAIN_URL = window.location.origin;

export const Promotions = () => {
  const [promotionData, setPromotionData] = useState(null);
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPromotion, setSelectedPromotion] = useState(null);
  const [editedDiscount, setEditedDiscount] = useState("");
  const [publishing, setPublishing] = useState(false);
  const { company_id, application_id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPromotions = async () => {
      try {
        const { data } = await axios.get(
          urlJoin(EXAMPLE_MAIN_URL, '/api/products/suggest-promotion'),
          {
            params: {
              product_name: "iPhone 16 Pro Max 256GB",
              current_price: 144900,
              product_category: "Smartphones"
            },
            headers: {
              "x-company-id": company_id,
            }
          }
        );
        if (data.success) {
          console.log("Fetched Promotions:", data);
          setPromotionData(data);
          // Handle both array and single object response
          const schemes = Array.isArray(data.promotion_scheme) 
            ? data.promotion_scheme 
            : [data.promotion_scheme];
          setPromotions(schemes);
        } else {
          setError("Failed to fetch promotions");
        }
      } catch (err) {
        console.error("Error fetching promotions:", err);
        setError(err.message || "Failed to fetch promotions");
      } finally {
        setLoading(false);
      }
    };

    fetchPromotions();
  }, [company_id]);

  const goBack = () => {
    const basePath = application_id 
      ? `/company/${company_id}/application/${application_id}`
      : `/company/${company_id}`;
    navigate(basePath);
  };

  const openModal = (promotion) => {
    setSelectedPromotion(promotion);
    setEditedDiscount(promotion.discount_percentage);
  };

  const closeModal = () => {
    setSelectedPromotion(null);
    setEditedDiscount("");
  };

  const handleDiscountChange = (e) => {
    setEditedDiscount(e.target.value);
  };

  const handlePublishPromotion = async () => {
    if (!selectedPromotion) return;
    
    setPublishing(true);
    
    try {
      const API_URL = urlJoin(EXAMPLE_MAIN_URL, '/api/products/publish-promotion');
      
      // Create the promotion data with the edited discount
      const promotionPayload = {
        promotion: {
          scheme_name: selectedPromotion.scheme_name,
          discount_percentage: Number(editedDiscount),
          discount_type: selectedPromotion.discount_type,
          duration_days: selectedPromotion.duration_days,
          target_segment: selectedPromotion.target_segment,
          reason: selectedPromotion.reason,
          competitor_analysis: selectedPromotion.competitor_analysis,
          seasonal_factor: selectedPromotion.seasonal_factor
        }
      };

      const response = await axios.post(API_URL, promotionPayload, {
        headers: {
          "Content-Type": "application/json",
          "x-company-id": company_id,
        }
      });

      console.log("Promotion published successfully:", response.data);
      alert("Promotion published successfully!");
      closeModal();
    } catch (err) {
      console.error("Error publishing promotion:", err);
      alert("Failed to publish promotion. Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  const getDiscountColor = (percentage) => {
    if (percentage >= 10) return "#00695c";
    if (percentage >= 7) return "#1565c0";
    return "#7b1fa2";
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Generating AI Promotion Suggestions...</p>
          <span className="loading-subtext">Analyzing market trends, competitor pricing & seasonal factors</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-content">
          <h2>Oops! Something went wrong</h2>
          <p>{error}</p>
          <button onClick={goBack} className="back-btn">Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="promotions-page">
      {/* Header */}
      <header className="promotions-top-bar">
        <button className="back-button" onClick={goBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Dashboard
        </button>
        <div className="ai-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          Powered by {promotionData?.ai_model || "Gemini AI"}
        </div>
      </header>

      <div className="promotions-container">
        <div className="promotions-header">
          <div className="header-content">
            <h1>AI Promotion Suggestions</h1>
            <p className="product-name">{promotionData?.product || "iPhone 16 Pro Max 256GB"}</p>
            <span className="generated-date">Generated on {promotionData?.generated_at || new Date().toLocaleDateString()}</span>
          </div>
        </div>

        <div className="promotions-grid">
          {promotions.map((promo, index) => (
            <div
              key={index}
              className="promotion-card"
              onClick={() => openModal(promo)}
              style={{ '--accent-color': getDiscountColor(promo.discount_percentage) }}
            >
              <div className="card-accent"></div>
              <div className="card-content">
                <div className="card-header">
                  <span className="discount-badge" style={{ backgroundColor: getDiscountColor(promo.discount_percentage) }}>
                    {promo.discount_percentage}% OFF
                  </span>
                  <span className="duration-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    {promo.duration_days} Days
                  </span>
                </div>
                <h3 className="scheme-name">{promo.scheme_name}</h3>
                <div className="card-body">
                  <div className="info-row">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span>{promo.target_segment}</span>
                  </div>
                  <div className="info-row">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <span>{promo.discount_type}</span>
                  </div>
                </div>
                <div className="card-footer">
                  <span className="view-details">View Details →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {selectedPromotion && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={closeModal}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            
            <div className="modal-header">
              <span className="modal-discount-badge" style={{ backgroundColor: getDiscountColor(selectedPromotion.discount_percentage) }}>
                {selectedPromotion.discount_percentage}% OFF
              </span>
              <h2>{selectedPromotion.scheme_name}</h2>
              <div className="modal-meta">
                <span><strong>Duration:</strong> {selectedPromotion.duration_days} Days</span>
                <span><strong>Type:</strong> {selectedPromotion.discount_type}</span>
              </div>
            </div>
            
            <div className="modal-body">
              <div className="detail-section">
                <div className="detail-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                  </svg>
                </div>
                <div className="detail-content">
                  <span className="detail-label">Target Segment</span>
                  <p className="detail-value">{selectedPromotion.target_segment}</p>
                </div>
              </div>

              <div className="detail-section">
                <div className="detail-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </div>
                <div className="detail-content">
                  <span className="detail-label">Reasoning</span>
                  <p className="detail-value">{selectedPromotion.reason}</p>
                </div>
              </div>
              
              <div className="detail-section">
                <div className="detail-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                  </svg>
                </div>
                <div className="detail-content">
                  <span className="detail-label">Competitor Analysis</span>
                  <p className="detail-value">{selectedPromotion.competitor_analysis}</p>
                </div>
              </div>

              <div className="detail-section">
                <div className="detail-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                </div>
                <div className="detail-content">
                  <span className="detail-label">Seasonal Factor</span>
                  <p className="detail-value">{selectedPromotion.seasonal_factor}</p>
                </div>
              </div>

              <div className="edit-section">
                <h4>Customize Discount</h4>
                <div className="edit-row">
                  <div className="input-group">
                    <input
                      type="number"
                      className="discount-input"
                      value={editedDiscount}
                      onChange={handleDiscountChange}
                      min="1"
                      max="100"
                    />
                    <span className="input-suffix">%</span>
                  </div>
                  <div className="calculated-price">
                    <span>New Price: </span>
                    <strong>₹{Math.round(144900 * (1 - editedDiscount / 100)).toLocaleString('en-IN')}</strong>
                  </div>
                </div>
                <button className="publish-btn" onClick={handlePublishPromotion} disabled={publishing}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13"></path>
                    <path d="M22 2L15 22L11 13L2 9L22 2Z"></path>
                  </svg>
                  {publishing ? "Publishing..." : "Publish This Discount to Users"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
