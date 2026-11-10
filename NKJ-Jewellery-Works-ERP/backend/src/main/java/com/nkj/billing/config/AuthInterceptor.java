// package com.nkj.billing.config;
// import com.nkj.billing.service.AuthService;
// import jakarta.servlet.http.*;
// import org.springframework.stereotype.Component;
// import org.springframework.web.servlet.HandlerInterceptor;
// @Component
// public class AuthInterceptor implements HandlerInterceptor {
//  private final AuthService auth;
//  public AuthInterceptor(AuthService auth){this.auth=auth;}
//  @Override public boolean preHandle(HttpServletRequest req,HttpServletResponse res,Object handler)throws Exception{
//   String h=req.getHeader("Authorization");String token=h!=null&&h.startsWith("Bearer ")?h.substring(7):"";
//   if(auth.valid(token))return true;
//   res.setStatus(401);res.setContentType("application/json");res.getWriter().write("{\"message\":\"Administrator login required\"}");return false;
//  }
// }


package com.nkj.billing.config;

import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import com.nkj.billing.service.AuthService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class AuthInterceptor implements HandlerInterceptor {

    private final AuthService auth;

    public AuthInterceptor(AuthService auth) {
        this.auth = auth;
    }

    @Override
    public boolean preHandle(
            HttpServletRequest req,
            HttpServletResponse res,
            Object handler
    ) throws Exception {

        // Allow CORS preflight requests.
        if ("OPTIONS".equalsIgnoreCase(req.getMethod())) {
            return true;
        }

        // Public users may create a new invoice from the public homepage.
        // All invoice reads, details, deletes and /api/admin endpoints still
        // require a valid administrator session.
        String requestPath = req.getRequestURI();
        String contextPath = req.getContextPath();
        if (contextPath != null && !contextPath.isEmpty() && requestPath.startsWith(contextPath)) {
            requestPath = requestPath.substring(contextPath.length());
        }
        if ("GET".equalsIgnoreCase(req.getMethod())
                && ("/api/designs".equals(requestPath) || "/api/designs/categories".equals(requestPath)
                    || requestPath.startsWith("/api/designs/"))) {
            // The public jewellery gallery exposes active designs only.
            // Management APIs remain under /api/admin/designs and require owner auth.
            return true;
        }

        if (("GET".equalsIgnoreCase(req.getMethod()) && "/api/invoices/date-support".equals(requestPath))
                || ("POST".equalsIgnoreCase(req.getMethod()) &&
                ("/api/invoices".equals(requestPath) || "/api/invoices/verify-pin".equals(requestPath) || "/api/invoices/consume-print-ticket".equals(requestPath)))) {
            // This endpoint exposes only feature/database readiness flags and
            // must be reachable by public staff who are allowed to create invoices.
            return true;
        }

        String header = req.getHeader("Authorization");

        String token = header != null && header.startsWith("Bearer ")
                ? header.substring(7)
                : "";

        if (auth.valid(token)) {
            return true;
        }

        res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        res.setContentType("application/json");
        res.getWriter().write(
                "{\"message\":\"Administrator login required\"}"
        );

        return false;
    }
}