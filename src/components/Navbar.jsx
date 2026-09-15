import React from 'react';
import '../style.css'; // Ensure we can style it

const Navbar = ({ activeTab, setTab, isMobile }) => {
    const allTabs = [
        { id: 'keywords', label: '我们的星图' },
        { id: 'towhere', label: '旅行地球' },
        { id: 'breaking', label: '第一次' },
        { id: 'anniversary', label: '纪念日' },
    ];

    const tabs = isMobile ? allTabs.filter(t => ['towhere', 'breaking', 'anniversary'].includes(t.id)) : allTabs;

    return (
        <nav className="fixed-navbar">
            <div className="navbar-container">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </nav>
    );
};

export default Navbar;
