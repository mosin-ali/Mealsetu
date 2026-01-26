import React, { useState, useMemo } from 'react'; 
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './VendorDashboard.css';

const VendorDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [kitchenOpen, setKitchenOpen] = useState(true);
  const [menuCycle, setMenuCycle] = useState('Daily');
  const [reportFilter, setReportFilter] = useState('Daily Overview');

  // --- NEW STATE HOOKS ADDED ---
  const [reviews] = useState([
    { id: 1, user: "Mosin Ali", rating: 5, comment: "Amazing Jain food! Very hygienic.", date: "2026-01-25" },
    { id: 2, user: "Priya Sharma", rating: 4, comment: "Quantity is good, maybe add more spice?", date: "2026-01-24" }
  ]);

  const [notifications, setNotifications] = useState([
    { id: 1, text: "New Order received from Aryan Patel!", type: "order" },
    { id: 2, text: "Menu for next week is now live.", type: "menu" }
  ]);

  const [isApproved, setIsApproved] = useState(false); // Admin approval state
  const [documents, setDocuments] = useState({ fssai: null, gst: null });

  // --- SUBSCRIPTION DATA GENERATOR ---
  const activeSubscriptions = useMemo(() => {
    const customers = [
      { id: 1, name: "Mosin Ali", phone: "+91 98XXX-X0010", plan: "Monthly", expiry: "2026-02-15", pref: "No Garlic" },
      { id: 2, name: "Priya Sharma", phone: "+91 91XXX-X5521", plan: "Weekly", expiry: "2026-01-28", pref: "Regular" },
      { id: 3, name: "Rahul Varma", phone: "+91 88XXX-X9910", plan: "Monthly", expiry: "2026-01-24", pref: "Jain" },
      { id: 4, name: "Sneha Kapur", phone: "+91 77XXX-X2233", plan: "Trial", expiry: "2026-01-30", pref: "Swaminarayan" },
    ];
    const today = new Date("2026-01-26"); 
    return customers.map(sub => {
      const expiryDate = new Date(sub.expiry);
      const diffTime = expiryDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      let status = "Active";
      let statusColor = "#16a34a";
      if (diffDays < 0) {
        status = "Expired";
        statusColor = "#ef4444";
      } else if (diffDays <= 3) {
        status = `Expiring in ${diffDays}d`;
        statusColor = "#f26522";
      }
      return { ...sub, status, statusColor, diffDays };
    });
  }, []);

  // --- PROFILE STATE ---
  const [profile, setProfile] = useState({
    kitchenName: "Annapurna Home Kitchen",
    address: "123, Foodie Lane, Near Metro Station, Mumbai",
    phone: "+91 9876543210",
    image: null 
  });

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile(prev => ({ ...prev, image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const reportData = useMemo(() => {
    const data = [];
    const types = ["Daily Overview", "Weekly Analysis", "Monthly Statement"];
    for (let i = 1; i <= 100; i++) {
      data.push({
        id: `TXN-99${100 + i}`,
        date: new Date(2026, 0, (i % 28) + 1).toLocaleDateString('en-IN'),
        orders: Math.floor(Math.random() * 50) + 10 + " Meals",
        earning: (Math.random() * 5000 + 1000).toFixed(2),
        status: "Settled",
        scope: i <= 30 ? types[0] : i <= 60 ? types[1] : types[2]
      });
    }
    return data;
  }, []);

  const filteredReports = reportData.filter(r => r.scope === reportFilter);

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(50);
      doc.setTextColor(240, 240, 240);
      doc.text("MEALSETU PARTNER", pageWidth / 2, pageHeight / 2, { align: "center", angle: 45 });
      doc.setFontSize(20);
      doc.setTextColor(242, 101, 34); 
      doc.text("MealSetu Earning Report", 14, 22);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Report Type: ${reportFilter}`, 14, 32);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 38);
      const tableColumn = ["Transaction ID", "Date", "Orders", "Earning (INR)", "Status"];
      const tableRows = filteredReports.map(item => [item.id, item.date, item.orders, `Rs. ${item.earning}`, item.status]);
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        theme: 'grid',
        headStyles: { fillColor: [43, 54, 116], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [244, 247, 254] },
        margin: { top: 45 }
      });
      doc.save(`MealSetu_${reportFilter.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
    } catch (error) {
      console.error("PDF Error:", error);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      navigate('/login');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="dashboard-view">
            <div className="v-card" style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px', borderLeft: '5px solid #f26522' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#f4f7fe', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px solid #ddd' }}>
                    {profile.image ? <img src={profile.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Kitchen" /> : '🍳'}
                </div>
                <div>
                    <h2 style={{ margin: 0, color: '#2b3674' }}>{profile.kitchenName}</h2>
                    <p style={{ margin: '5px 0 0 0', color: '#a3aed0', fontSize: '14px' }}>📍 {profile.address}</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              <div className="v-card" style={{ marginBottom: 0 }}>
                <p style={{ color: '#a3aed0', fontSize: '14px', margin: '0 0 10px 0' }}>Total Revenue</p>
                <h2 style={{ color: '#2b3674', margin: 0 }}>₹12,840</h2>
              </div>
              <div className="v-card" style={{ marginBottom: 0 }}>
                <p style={{ color: '#a3aed0', fontSize: '14px', margin: '0 0 10px 0' }}>Orders Today</p>
                <h2 style={{ color: '#2b3674', margin: 0 }}>42</h2>
              </div>
              <div className="v-card" style={{ marginBottom: 0 }}>
                <p style={{ color: '#a3aed0', fontSize: '14px', margin: '0 0 10px 0' }}>Active Users</p>
                <h2 style={{ color: '#2b3674', margin: 0 }}>156</h2>
              </div>
              <div className="v-card" style={{ marginBottom: 0 }}>
                <p style={{ color: '#a3aed0', fontSize: '14px', margin: '0 0 10px 0' }}>Pending Payout</p>
                <h2 style={{ color: '#f26522', margin: 0 }}>₹3,200</h2>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px' }}>
              <div className="v-card">
                <h3>Today's Preparation List</h3>
                <p style={{ color: '#a3aed0' }}>Total lunch boxes to pack: 85</p>
                <hr style={{ border: 'none', borderTop: '1px solid #f4f7fe', margin: '15px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}><span>Regular Thali</span><span style={{ fontWeight: '700' }}>52</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}><span>Jain Thali</span><span style={{ fontWeight: '700' }}>24</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}><span>Swaminarayan Thali</span><span style={{ fontWeight: '700' }}>9</span></div>
              </div>
              <div className="v-card">
                <h3>Kitchen Status</h3>
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                   <div style={{ fontSize: '40px', color: kitchenOpen ? '#16a34a' : '#ef4444', marginBottom: '10px' }}>{kitchenOpen ? '👨‍🍳' : '💤'}</div>
                   <p style={{ fontWeight: '600' }}>{kitchenOpen ? 'Kitchen is Live' : 'Kitchen is Resting'}</p>
                   <p style={{ fontSize: '12px', color: '#a3aed0' }}>{kitchenOpen ? 'Accepting new trial orders.' : 'Not accepting new orders.'}</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'menu':
        return (
          <div className="v-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px' }}>
              <h3 style={{ color: '#2b3674' }}>{menuCycle} Menu Planner</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                {['Daily', 'Weekly', 'Monthly'].map(cycle => (
                  <button key={cycle} onClick={() => setMenuCycle(cycle)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: menuCycle === cycle ? '#f26522' : '#f4f7fe', color: menuCycle === cycle ? '#fff' : '#2b3674', fontWeight: '600' }}>{cycle}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
              <div><label style={{ fontSize: '14px', fontWeight: '600' }}>Main Sabji</label><input className="v-input" placeholder="e.g. Paneer Butter Masala" /></div>
              <div><label style={{ fontSize: '14px', fontWeight: '600' }}>Alternative Sabji</label><input className="v-input" placeholder="e.g. Mix Veg Fry" /></div>
              <div><label style={{ fontSize: '14px', fontWeight: '600' }}>Sweet Item</label><input className="v-input" placeholder="e.g. Gulab Jamun" /></div>
              <div><label style={{ fontSize: '14px', fontWeight: '600' }}>Dietary Category</label><select className="v-input"><option>Regular</option><option>Jain</option><option>Swaminarayan</option></select></div>
            </div>
            <button className="v-nav-btn" style={{ background: '#f26522', color: 'white', width: 'auto', padding: '15px 40px', marginTop: '30px', justifyContent: 'center' }}>Update {menuCycle} Menu</button>
          </div>
        );

      case 'orders':
        return (
          <div className="v-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Orders & Upcoming Deliveries</h3>
              <div style={{ display: 'flex', gap: '10px' }}><input type="date" className="v-input" style={{ width: 'auto', margin: 0 }} /><button style={{ background: '#1e293b', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer' }}>Filter</button></div>
            </div>
            <table className="v-table">
              <thead><tr><th>Order ID</th><th>Customer Name</th><th>Meal Preference</th><th>Delivery Slot</th><th>Status</th></tr></thead>
              <tbody>
                <tr><td>#MS-771</td><td>Aryan Patel</td><td>Jain</td><td>Today (Lunch)</td><td><span className="status-tag" style={{ background: '#fff3ed', color: '#f26522' }}>In Kitchen</span></td></tr>
              </tbody>
            </table>
          </div>
        );

      case 'customers':
        return (
          <div className="v-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Active Subscriptions</h3>
              <div style={{ background: '#fff3ed', color: '#f26522', padding: '5px 15px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>Total: {activeSubscriptions.filter(s => s.status !== "Expired").length}</div>
            </div>
            <table className="v-table">
              <thead><tr><th>Name</th><th>Contact</th><th>Plan</th><th>Expiry</th><th>Status</th></tr></thead>
              <tbody>
                {activeSubscriptions.map((sub) => (
                  <tr key={sub.id}>
                    <td><div style={{ fontWeight: 'bold' }}>{sub.name}</div><div style={{ fontSize: '11px', color: '#a3aed0' }}>{sub.pref}</div></td>
                    <td>{sub.phone}</td>
                    <td><span style={{ background: '#f4f7fe', padding: '4px 8px', borderRadius: '5px', fontSize: '12px' }}>{sub.plan}</span></td>
                    <td>{new Date(sub.expiry).toLocaleDateString('en-IN')}</td>
                    <td><span className="status-tag" style={{ background: sub.statusColor + '15', color: sub.statusColor, border: `1px solid ${sub.statusColor}` }}>{sub.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'reports':
        return (
          <div className="v-card">
            <div className="pdf-watermark">MEALSETU PARTNER</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Earnings & Reports</h3>
              <button onClick={handleDownloadPDF} style={{ background: '#f26522', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>📥 Download PDF</button>
            </div>
            <div style={{ marginTop: '20px' }}>
              <select className="v-input" style={{ width: '200px' }} value={reportFilter} onChange={(e) => setReportFilter(e.target.value)}>
                <option>Daily Overview</option><option>Weekly Analysis</option><option>Monthly Statement</option>
              </select>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '30px' }}>
              <table className="v-table">
                <thead><tr><th>Transaction ID</th><th>Date</th><th>Orders</th><th>Earning</th><th>Status</th></tr></thead>
                <tbody>
                  {filteredReports.map((row) => (
                    <tr key={row.id}><td>{row.id}</td><td>{row.date}</td><td>{row.orders}</td><td>₹ {row.earning}</td><td><span style={{ color: '#16a34a', fontWeight: 'bold' }}>{row.status}</span></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="v-card">
            <h3 style={{ color: '#2b3674' }}>Kitchen Profile Settings</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div><label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>Kitchen Name</label><input className="v-input" name="kitchenName" value={profile.kitchenName} onChange={handleProfileChange} /></div>
                <div><label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>Complete Address</label><textarea className="v-input" name="address" style={{ height: '100px', paddingTop: '10px' }} value={profile.address} onChange={handleProfileChange} /></div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '200px', height: '200px', borderRadius: '20px', border: '2px dashed #cbd5e1', margin: '0 auto', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', background: '#f8fafc' }}>
                  {profile.image ? <img src={profile.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Preview" /> : <span style={{ color: '#94a3b8' }}>No Image</span>}
                </div>
                <input type="file" accept="image/*" id="imageUpload" hidden onChange={handleImageUpload} />
                <label htmlFor="imageUpload" style={{ display: 'inline-block', marginTop: '20px', padding: '10px 20px', background: '#f26522', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Change Image</label>
              </div>
            </div>
            <button className="v-nav-btn" style={{ background: '#2b3674', color: 'white', width: '200px', justifyContent: 'center', marginTop: '30px' }} onClick={() => alert('Profile saved locally!')}>Save Changes</button>
          </div>
        );

      // --- NEW RENDER CONTENT CASES ---
      case 'reviews':
        return (
          <div className="v-card">
            <h3>Customer Reviews & Feedback</h3>
            <div style={{ marginTop: '20px' }}>
              {reviews.map(rev => (
                <div key={rev.id} style={{ padding: '15px', borderBottom: '1px solid #f4f7fe' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{rev.user}</strong>
                    <span style={{ color: '#f26522' }}>{'⭐'.repeat(rev.rating)}</span>
                  </div>
                  <p style={{ color: '#444', fontSize: '14px', margin: '5px 0' }}>{rev.comment}</p>
                  <small style={{ color: '#a3aed0' }}>{rev.date}</small>
                </div>
              ))}
            </div>
          </div>
        );

      case 'compliance':
        return (
          <div className="v-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Kitchen Compliance & Licenses</h3>
              {isApproved ? (
                <div style={{ background: '#dcfce7', color: '#16a34a', padding: '10px 20px', borderRadius: '30px', fontWeight: 'bold', border: '1px solid #16a34a' }}>
                  ✅ Verified Partner (Admin Approved)
                </div>
              ) : (
                <div style={{ background: '#fef2f2', color: '#ef4444', padding: '10px 20px', borderRadius: '30px', fontWeight: 'bold' }}>
                  ⏳ Pending Admin Approval
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '30px' }}>
              <div style={{ border: '2px dashed #ddd', padding: '20px', borderRadius: '15px', textAlign: 'center' }}>
                <p><strong>FSSAI License</strong></p>
                <input type="file" onChange={(e) => setDocuments({...documents, fssai: e.target.files[0]})} />
                {documents.fssai && <p style={{ color: '#16a34a', fontSize: '12px' }}>Selected: {documents.fssai.name}</p>}
              </div>
              <div style={{ border: '2px dashed #ddd', padding: '20px', borderRadius: '15px', textAlign: 'center' }}>
                <p><strong>GST/Tax Document</strong></p>
                <input type="file" onChange={(e) => setDocuments({...documents, gst: e.target.files[0]})} />
                {documents.gst && <p style={{ color: '#16a34a', fontSize: '12px' }}>Selected: {documents.gst.name}</p>}
              </div>
            </div>
            <button 
              className="v-nav-btn" 
              style={{ background: '#f26522', color: 'white', marginTop: '20px', width: '200px', justifyContent: 'center' }}
              onClick={() => { alert("Documents uploaded for review!"); setIsApproved(false); }}
            >
              Submit for Approval
            </button>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="vendor-container">
      <aside className="v-sidebar">
        <h2 style={{ color: '#f26522', fontWeight: '800', marginBottom: '30px' }}>MealSetu</h2>
        <nav style={{ flex: 1 }}>
          <button className={`v-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>📊 Overview</button>
          <button className={`v-nav-btn ${activeTab === 'menu' ? 'active' : ''}`} onClick={() => setActiveTab('menu')}>🍴 Menu Planner</button>
          <button className={`v-nav-btn ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>📦 Order Tracking</button>
          <button className={`v-nav-btn ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>👥 My Customers</button>
          <button className={`v-nav-btn ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>📜 Reports & PDF</button>
          {/* NEW BUTTONS ADDED TO SIDEBAR */}
          <button className={`v-nav-btn ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>⭐ Reviews</button>
          <button className={`v-nav-btn ${activeTab === 'compliance' ? 'active' : ''}`} onClick={() => setActiveTab('compliance')}>📜 Compliance</button>
          <button className={`v-nav-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>⚙️ Edit Profile</button>
        </nav>
        <button className="v-nav-btn" onClick={handleLogout} style={{ color: '#ef4444', marginTop: 'auto' }}>🚪 Logout Session</button>
      </aside>

      <main className="vendor-main">
        {/* NEW NOTIFICATION UI ADDED AT TOP OF MAIN */}
        {notifications.length > 0 && (
          <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {notifications.map(n => (
              <div key={n.id} style={{ background: '#2b3674', color: 'white', padding: '15px 25px', borderRadius: '12px', boxShadow: '0 10px 15px rgba(0,0,0,0.1)', display: 'flex', gap: '15px', alignItems: 'center' }}>
                <span>{n.type === 'order' ? '🔔' : '📝'}</span>
                <span>{n.text}</span>
                <button onClick={() => setNotifications(notifications.filter(notif => notif.id !== n.id))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <div>
            <h1 style={{ color: '#2b3674', margin: 0 }}>Vendor Portal</h1>
            <p style={{ color: '#a3aed0', margin: '5px 0' }}>Manage your kitchen operations</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', background: 'white', padding: '10px 20px', borderRadius: '15px' }}>
            <span style={{ fontWeight: '700', color: kitchenOpen ? '#16a34a' : '#ef4444' }}>
              {kitchenOpen ? '● Kitchen is Open' : '○ Kitchen is Closed'}
            </span>
            <button onClick={() => { setKitchenOpen(!kitchenOpen); alert(kitchenOpen ? "Closing Kitchen" : "Opening Kitchen"); }} style={{ background: kitchenOpen ? '#ef4444' : '#16a34a', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
              {kitchenOpen ? 'Close Shop' : 'Open Shop'}
            </button>
          </div>
        </header>

        {renderContent()}
      </main>
    </div>
  );
};

export default VendorDashboard;