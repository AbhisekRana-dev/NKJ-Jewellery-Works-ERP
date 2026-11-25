
import "./Footer.css";
import React from "react";
import { Link } from "react-router-dom";
import {
  Home,
  FileText,
  LogIn,
  Phone,
  MapPin,
  Code2,
  UserRound,
} from "lucide-react";

const Footer = () => {
  return (
    <footer
      className="jewellery-footer"
      aria-label="Nandikishor Jewellery Works footer"
    >
      <div className="footer-main">

        {/* BRAND */}
        <div className="footer-brand">
          <div className="footer-logo" aria-label="NKJ">
            <span className="logo-crown" aria-hidden="true">
              ♛
            </span>
            NKJ
          </div>

          <div className="brand-text">
            <h2>Nandikishor Jewellery Works</h2>
            <p>
              Sasra, Gopiballavpur, Jhargram,
              <br />
              West Bengal - 721506
            </p>
          </div>
        </div>

        {/* QUICK LINKS */}
        <div className="footer-links">
          <h3>Quick Links</h3>

          <Link to="/">
            <Home size={16} />
            <span>Home</span>
          </Link>

          <Link to="/invoice">
            <FileText size={16} />
            <span>New Invoice</span>
          </Link>

          <Link to="/login">
            <LogIn size={16} />
            <span>Owner Login</span>
          </Link>
        </div>

        {/* CONTACT */}
        <div className="footer-contact">
          <h3>Contact Us</h3>

          <div className="contact-item">
            <UserRound size={17} />
            <span>
              <span className="proprietor-label">Pro:</span>
              Bhuteswar Rana
            </span>
          </div>

          <div className="contact-item">
            <Phone size={17} />
            <span>
              <a href="tel:+9199322770722">
                +91 99322770722
              </a>
              <span className="contact-separator"> | </span>
              <a href="tel:+918116022248">
                +91 8116022248
              </a>
            </span>
          </div>

          <div className="contact-item">
            <MapPin size={17} />
            <span>
              Sasra, Gopiballavpur, Jhargram,
              West Bengal - 721506
            </span>
          </div>
        </div>

        {/* DIAMOND */}
        <div className="footer-diamond" aria-hidden="true">
          <svg
            viewBox="0 0 120 75"
            width="120"
            height="75"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 22 L28 5 H92 L110 22 L60 68 Z" />
            <path d="M10 22 H110" />
            <path d="M28 5 L45 22 L60 68 L75 22 L92 5" />
            <path d="M28 5 L45 22 H75 L92 5" />
          </svg>
        </div>

        {/* DEVELOPER */}
        <div className="footer-developer">
          <p className="developer-heading">
            Designed &amp; Built with <span>❤️</span> by
          </p>

          <div className="developer-bottom">
            <span className="developer-name">
              <Code2 size={19} />
              Abhisek Rana
            </span>

            <span className="version-tag">
              v1.0.0
            </span>
          </div>
        </div>

      </div>

      {/* COPYRIGHT */}
      <div className="footer-copyright">
        © 2026 Nandikishor Jewellery Works. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
