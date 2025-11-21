# Page snapshot

```yaml
- text: Sign In Enter your credentials to access your account Email
- textbox "Email": admin@invoice.test
- text: Password
- textbox "Password": password123
- paragraph: Invalid credentials
- button "Sign In"
- paragraph:
  - text: Don't have an account?
  - link "Sign up":
    - /url: /auth/signup
- button "Open Tanstack query devtools":
  - img
- alert
- button "Open Next.js Dev Tools":
  - img
```