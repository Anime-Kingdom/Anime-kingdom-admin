package in.animekingdom.admin;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.webkit.*;
import java.io.ByteArrayInputStream;
public class MainActivity extends Activity {
 private WebView web;
 private ValueCallback<Uri[]> chooser;
 private static final String HOST="appassets.androidplatform.net";
 public void onCreate(Bundle state){
  super.onCreate(state);getWindow().setFlags(8192,8192);
  web=new WebView(this);setContentView(web);
  web.getSettings().setJavaScriptEnabled(true);
  web.getSettings().setDomStorageEnabled(true);
  web.getSettings().setAllowFileAccess(false);
  web.getSettings().setAllowContentAccess(true);
  web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  web.getSettings().setSaveFormData(false);
  web.setWebViewClient(new WebViewClient(){
   public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return !HOST.equals(r.getUrl().getHost());}
   public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){
    Uri u=r.getUrl();if(HOST.equals(u.getHost())){
     String name=u.getPath();if("/".equals(name))name="/index.html";
     if(!name.matches("/(index.html|app.js|style.css)"))return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));
     try{return new WebResourceResponse(name.endsWith(".js")?"text/javascript":name.endsWith(".css")?"text/css":"text/html","UTF-8",getAssets().open(name.substring(1)));}catch(Exception e){return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));}
    }return null;
   }
  });
  web.setWebChromeClient(new WebChromeClient(){
   public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,FileChooserParams p){
    if(chooser!=null)chooser.onReceiveValue(null);chooser=cb;
    Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("image/*");i.addCategory(Intent.CATEGORY_OPENABLE);
    try{startActivityForResult(i,10);}catch(Exception e){chooser.onReceiveValue(null);chooser=null;}return true;
   }
  });
  web.loadUrl("https://"+HOST+"/index.html");
 }
 protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==10&&chooser!=null){Uri u=result==RESULT_OK&&data!=null?data.getData():null;chooser.onReceiveValue(u!=null&&"content".equals(u.getScheme())?new Uri[]{u}:null);chooser=null;}}
 protected void onDestroy(){if(chooser!=null)chooser.onReceiveValue(null);web.destroy();super.onDestroy();}
}
