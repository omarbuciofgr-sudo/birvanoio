import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().trim().email("Please enter a valid email address").max(255);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters");
const nameSchema = z.string().trim().min(1, "Required").max(100);
const phoneSchema = z.string().trim().min(7, "Enter a valid phone number").max(20);
const companySchema = z.string().trim().min(1, "Company name is required").max(200);
const roleSchema = z.string().trim().min(1, "Role is required").max(100);
const industrySchema = z.string().min(1, "Industry is required");

const INDUSTRIES = [
  "Real Estate",
  "SaaS / Technology",
  "Marketing / Agency",
  "Financial Services",
  "Healthcare",
  "E-Commerce / Retail",
  "Construction",
  "Legal",
  "Insurance",
  "Education",
  "Consulting",
  "Manufacturing",
  "Other",
];

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          navigate("/dashboard");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) newErrors.email = emailResult.error.errors[0].message;

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) newErrors.password = passwordResult.error.errors[0].message;

    if (!isLogin) {
      const fnResult = nameSchema.safeParse(firstName);
      if (!fnResult.success) newErrors.firstName = "First name is required";

      const lnResult = nameSchema.safeParse(lastName);
      if (!lnResult.success) newErrors.lastName = "Last name is required";

      const phoneResult = phoneSchema.safeParse(phone);
      if (!phoneResult.success) newErrors.phone = phoneResult.error.errors[0].message;

      const companyResult = companySchema.safeParse(companyName);
      if (!companyResult.success) newErrors.companyName = companyResult.error.errors[0].message;

      const roleResult = roleSchema.safeParse(roleTitle);
      if (!roleResult.success) newErrors.roleTitle = roleResult.error.errors[0].message;

      const industryResult = industrySchema.safeParse(industry);
      if (!industryResult.success) newErrors.industry = industryResult.error.errors[0].message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error("Google sign-in failed. Please try again.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              first_name: firstName,
              last_name: lastName,
              phone: phone,
              company_name: companyName,
              role_title: roleTitle,
              industry: industry,
            },
          },
        });
        if (error) throw error;
        toast.success("Account created! Check your email to verify your account.");
      }
    } catch (error: any) {
      if (error.message?.includes("User already registered")) {
        toast.error("This email is already registered. Try signing in instead.");
      } else if (error.message?.includes("Invalid login credentials")) {
        toast.error("Invalid email or password. Please try again.");
      } else if (error.message?.includes("Email rate limit exceeded")) {
        toast.error("Too many attempts. Please try again later.");
      } else {
        toast.error("Unable to process your request. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/20" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="flex items-center space-x-2 mb-8">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="font-display font-bold text-primary-foreground">B</span>
            </div>
            <span className="font-display font-bold text-2xl text-foreground">BRIVANO</span>
          </div>
          
          <h1 className="font-display text-4xl font-bold text-foreground mb-4">
            Your Lead Dashboard
          </h1>
          <p className="text-muted-foreground text-lg max-w-md">
            Access your verified leads, track conversions, and manage your pipeline 
            all in one place.
          </p>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </button>

        <div className="max-w-sm mx-auto w-full lg:mx-0">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center space-x-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="font-display font-bold text-primary-foreground text-sm">B</span>
            </div>
            <span className="font-display font-bold text-xl text-foreground">BRIVANO</span>
          </div>

          <h2 className="font-display text-3xl font-bold text-foreground mb-2">
            {isLogin ? "Welcome back" : "Create account"}
          </h2>
          <p className="text-muted-foreground mb-6">
            {isLogin
              ? "Sign in to access your lead dashboard"
              : "Sign up to start managing your leads"}
          </p>

          {/* Google Sign In */}
          <Button
            type="button"
            variant="outline"
            className="w-full mb-4 gap-2"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {isGoogleLoading ? "Connecting..." : `Sign ${isLogin ? "in" : "up"} with Google`}
          </Button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {!isLogin && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Input
                      placeholder="First name *"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="bg-secondary/50 border-border"
                    />
                    {errors.firstName && <p className="text-destructive text-xs mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <Input
                      placeholder="Last name *"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="bg-secondary/50 border-border"
                    />
                    {errors.lastName && <p className="text-destructive text-xs mt-1">{errors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <Input
                    type="tel"
                    placeholder="Phone number *"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-secondary/50 border-border"
                  />
                  {errors.phone && <p className="text-destructive text-xs mt-1">{errors.phone}</p>}
                </div>

                <div>
                  <Input
                    placeholder="Company name *"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="bg-secondary/50 border-border"
                  />
                  {errors.companyName && <p className="text-destructive text-xs mt-1">{errors.companyName}</p>}
                </div>

                <div>
                  <Input
                    placeholder="Your role (e.g. CEO, Sales Manager) *"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    className="bg-secondary/50 border-border"
                  />
                  {errors.roleTitle && <p className="text-destructive text-xs mt-1">{errors.roleTitle}</p>}
                </div>

                <div>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger className="bg-secondary/50 border-border">
                      <SelectValue placeholder="Select your industry *" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((ind) => (
                        <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.industry && <p className="text-destructive text-xs mt-1">{errors.industry}</p>}
                </div>
              </>
            )}

            <div>
              <Input
                type="email"
                placeholder="Email *"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-secondary/50 border-border"
              />
              {errors.email && <p className="text-destructive text-xs mt-1">{errors.email}</p>}
            </div>

            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password *"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-secondary/50 border-border pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              {errors.password && <p className="text-destructive text-xs mt-1">{errors.password}</p>}
            </div>

            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setErrors({});
              }}
              className="text-primary hover:underline font-medium"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
