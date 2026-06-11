import React, { useState } from 'react';
import './css/Navbar.css';

function Navbar() {
    const [activeMenu, setActiveMenu] = useState('home');

    // fill diubah menjadi "currentColor" agar bisa dikontrol oleh CSS
    const menuItems = [
        { id: 'home', label: 'Analytics', icon: ( <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480v320q0 33-23.5 56.5T800-80H480Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 23 3 45t9 43l148-148 132 111 131-131h-63v-80h200v200h-80v-63L456-320 325-432 207-314q42 69 113.5 111.5T480-160Zm300 20q17 0 28.5-11.5T820-180q0-17-11.5-28.5T780-220q-17 0-28.5 11.5T740-180q0 17 11.5 28.5T780-140ZM455-480Z"/></svg>) },
        { id: 'chat', label: 'Tree', icon: (<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M216-176q-45-45-70.5-104T120-402q0-63 24-124.5T222-642q35-35 86.5-60t122-39.5Q501-756 591.5-759t202.5 7q8 106 5 195t-16.5 160.5q-13.5 71.5-38 125T684-182q-53 53-112.5 77.5T450-80q-65 0-127-25.5T216-176Zm112-16q29 17 59.5 24.5T450-160q46 0 91-18.5t86-59.5q18-18 36.5-50.5t32-85Q709-426 716-500.5t2-177.5q-49-2-110.5-1.5T485-670q-61 9-116 29t-90 55q-45 45-62 89t-17 85q0 59 22.5 103.5T262-246q42-80 111-153.5T534-520q-72 63-125.5 142.5T328-192Zm0 0Zm0 0Z"/></svg>) },
        { id: 'notif', label: 'Research', icon: (<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M200-120v-80h200v-80q-83 0-141.5-58.5T200-480q0-61 33.5-111t90.5-73q8-34 35.5-55t62.5-21l-22-62 38-14-14-36 76-28 12 38 38-14 110 300-38 14 14 38-76 28-12-38-38 14-24-66q-15 14-34.5 21t-39.5 5q-22-2-41-13.5T338-582q-27 16-42.5 43T280-480q0 50 35 85t85 35h320v80H520v80h240v80H200Zm346-458 36-14-68-188-38 14 70 188Zm-97.5-33.5Q460-623 460-640t-11.5-28.5Q437-680 420-680t-28.5 11.5Q380-657 380-640t11.5 28.5Q403-600 420-600t28.5-11.5ZM546-578Zm-126-62Zm0 0Z"/></svg>) },
        { id: 'profile', label: 'Developer', icon: (<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M240-360h96q19 0 32.5-13.5T382-406v-148q0-19-13.5-32.5T336-600h-96v240Zm46-46v-148h50v148h-50Zm149 46h98v-46h-82v-52h52v-46h-52v-50h82v-46h-98q-13 0-21.5 8.5T405-570v180q0 13 8.5 21.5T435-360Zm228.5-9.5Q673-378 676-391l56-209h-48l-43 164-43-164h-48l56 209q3 13 12.5 21.5T641-361q13 0 22.5-8.5ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z"/></svg>)},
    ];

    return (
        <nav className="navigation">
            <div className="menu-cover">
                {menuItems.map((item) => (
                    /* TAG <a> DITAMBAHKAN DI SINI */
                    <a
                        key={item.id}
                        href={`#${item.id}`}
                        className={activeMenu === item.id ? 'active' : ''}
                        onClick={(e) => {
                            e.preventDefault(); 
                            setActiveMenu(item.id);
                        }}
                    >
                        <span className="icon">{item.icon}</span>
                        <span className="label">{item.label}</span>
                    </a>
                ))}
            </div>
        </nav>
    ); 
}

export default Navbar;